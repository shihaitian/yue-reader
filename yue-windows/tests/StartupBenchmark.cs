using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using YueReader;

class StartupBenchmark {
    sealed class TestWindow : ReaderWindow {
        public TestWindow(string[] args) : base(args) { }
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams { get { var value = base.CreateParams; value.ExStyle |= 0x08000000; return value; } }
    }
    static object Field(object window, string name) { return typeof(ReaderWindow).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(window); }
    [STAThread] static void Main(string[] args) {
        var clock = Stopwatch.StartNew();
        string root = Path.GetFullPath(args[0]); Directory.CreateDirectory(root);
        Environment.SetEnvironmentVariable("YUE_READER_DATA", Path.Combine(root, "profile"));
        Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FFFAF9F6");
        Program.PipeName = "Yue-Benchmark-" + Guid.NewGuid().ToString("N");
        string fixture = Path.Combine(root, "benchmark.md");
        File.WriteAllText(fixture, "# Startup benchmark\n\nA small local document with **formatting**, a table and a code block.\n\n| Name | Value |\n| --- | --- |\n| Ready | Yes |\n\n```js\nconst ready = true;\n```\n\n![Local pixel](pixel.png)\n");
        File.WriteAllBytes(Path.Combine(root,"pixel.png"), Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="));
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        var timings = new Dictionary<string,object>();
        using (var window = new TestWindow(new[] { fixture })) {
            window.Opacity = 0; window.ShowInTaskbar = false;
            var web = (WebView2)Field(window, "web");
            var timer = new Timer { Interval = 10 };
            web.CoreWebView2InitializationCompleted += (s,e) => {
                timings["engineReadyMs"] = clock.ElapsedMilliseconds;
                if (!e.IsSuccess) return;
                web.CoreWebView2.DOMContentLoaded += (sender,ev) => timings["domReadyMs"] = clock.ElapsedMilliseconds;
                web.CoreWebView2.NavigationCompleted += (sender,ev) => timings["navigationReadyMs"] = clock.ElapsedMilliseconds;
                web.CoreWebView2.WebMessageReceived += (sender,ev) => {
                    var data = Program.Json.Deserialize<Dictionary<string,object>>(ev.WebMessageAsJson);
                    object type;
                    if (data.TryGetValue("type",out type) && ((string)type == "ready" || (string)type == "view-ready")) timings[(string)type + "Ms"] = clock.ElapsedMilliseconds;
                };
            };
            timer.Tick += async (s,e) => {
                if (clock.ElapsedMilliseconds > 20000) { timer.Stop(); timings["error"] = "Timed out"; File.WriteAllText(Path.Combine(root,"benchmark.json"),Program.Json.Serialize(timings)); Environment.ExitCode=1; window.Close(); return; }
                if (!(bool)Field(window,"viewRevealed")) return;
                timer.Stop();
                timings["documentVisibleMs"] = clock.ElapsedMilliseconds;
                try {
                    string name = await web.CoreWebView2.ExecuteScriptAsync("document.getElementById('current-filename').textContent");
                    if (name != "\"benchmark.md\"") throw new Exception("Wrong initial document: " + name);
                    bool imageLoaded = false;
                    for (int i=0;i<200;i++) {
                        if (await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('#article img')?.naturalWidth === 1") == "true") { imageLoaded=true; break; }
                        await Task.Delay(10);
                    }
                    if (!imageLoaded) throw new Exception("Initial local image reply was lost during startup.");
                    timings["navigation"] = Program.Json.Deserialize<object>(await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(performance.getEntriesByType('navigation')[0].toJSON())"));
                    timings["resources"] = Program.Json.Deserialize<object>(await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify(performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),start:r.startTime,duration:r.duration,bytes:r.decodedBodySize})))"));
                    string next = Path.Combine(root, "next.md"); File.WriteAllText(next,"# Next document\n\nReopening should use the existing reader.\n");
                    var reopen = Stopwatch.StartNew();
                    bool forwarded = await Task.Run(() => (bool)typeof(Program).GetMethod("Forward",BindingFlags.NonPublic|BindingFlags.Static).Invoke(null,new object[]{new[]{next}}));
                    if (!forwarded) throw new Exception("Document forwarding failed.");
                    for (int i=0;i<500;i++) {
                        string current = await web.CoreWebView2.ExecuteScriptAsync("document.getElementById('current-filename').textContent");
                        if (current == "\"next.md\"") { timings["nextDocumentMs"]=reopen.ElapsedMilliseconds; break; }
                        await Task.Delay(10);
                    }
                    if (!timings.ContainsKey("nextDocumentMs")) throw new Exception("Next document never appeared.");
                    // Let background persistence finish before the next process uses this profile.
                    await Task.Delay(150);
                } catch(Exception error) { timings["error"] = error.ToString(); Environment.ExitCode=1; }
                finally { File.WriteAllText(Path.Combine(root,"benchmark.json"),Program.Json.Serialize(timings)); window.Close(); }
            };
            window.Shown += (s,e) => { timings["windowShownMs"] = clock.ElapsedMilliseconds; timer.Start(); };
            Application.Run(window); timer.Dispose();
        }
    }
}
