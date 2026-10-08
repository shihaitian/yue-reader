using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using YueReader;

class StartupTests {
    sealed class TestWindow : ReaderWindow {
        public TestWindow(string[] args) : base(args) { }
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams { get { var parameters = base.CreateParams; parameters.ExStyle |= 0x08000000; return parameters; } }
    }
    static object Field(object owner, string name) { return typeof(ReaderWindow).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance).GetValue(owner); }
    [STAThread] static void Main(string[] args) {
        string root = Path.GetFullPath(args[0]); Directory.CreateDirectory(root);
        Environment.SetEnvironmentVariable("YUE_READER_DATA", Path.Combine(root, "profile"));
        Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FFFAF9F6");
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        Program.PipeName = "YueReader-StartupTest-" + Guid.NewGuid().ToString("N");
        string fixture = Path.Combine(root, "启动测试.md");
        File.WriteAllText(fixture, "# 启动测试\n\n这是一份独立的测试文档。暖纸底色应该在浏览器创建时就已生效。\n\n启动期间保持原生封面，正文就绪后才展示。\n");
        using (var window = new TestWindow(new[] { fixture })) {
            // Component integration test: the transparent test window never takes focus.
            window.Opacity = 0; window.ShowInTaskbar = false;
            var web = (WebView2)Field(window, "web");
            var loading = (Label)Field(window, "loading");
            bool exposedEarly = false;
            bool observing = false;
            var elapsed = Stopwatch.StartNew();
            var timer = new Timer { Interval = 30 };
            timer.Tick += async (s, e) => {
                if (web.CoreWebView2 != null && !observing) {
                    observing = true;
                    web.CoreWebView2.ProcessFailed += (sender, failed) => File.AppendAllText(Path.Combine(root, "process-failures.txt"), failed.ProcessFailedKind + ": " + failed.Reason + "\n");
                }
                bool ready = (bool)Field(window, "viewReady") && (bool)Field(window, "navigationReady");
                if (web.Visible && !ready) exposedEarly = true;
                if (elapsed.ElapsedMilliseconds > 20000) { timer.Stop(); File.WriteAllText(Path.Combine(root, "startup-result.txt"), "FAIL timeout: " + loading.Text); Environment.ExitCode = 1; window.Close(); return; }
                if (!web.Visible) return;
                timer.Stop();
                try {
                    if (exposedEarly || !ready || loading.Visible) throw new Exception("Reader was exposed before its document was ready.");
                    if (web.DefaultBackgroundColor.ToArgb() != Color.FromArgb(250,249,246).ToArgb()) throw new Exception("Wrong controller background.");
                    string name = await web.CoreWebView2.ExecuteScriptAsync("document.getElementById('current-filename').textContent");
                    if (!name.Contains("启动测试.md")) throw new Exception("Wrong initial document: " + name);
                    await Task.Delay(120);
                    string preview = Path.Combine(root, "startup-frame.png");
                    using (var stream = File.Create(preview)) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
                    int total=0, black=0, paper=0;
                    using (var bitmap = new Bitmap(preview)) for (int y=4;y<bitmap.Height;y+=8) for (int x=4;x<bitmap.Width;x+=8) {
                        var pixel=bitmap.GetPixel(x,y); total++;
                        if (pixel.R<12 && pixel.G<12 && pixel.B<12) black++;
                        if (pixel.R>240 && pixel.G>235 && pixel.B>222 && pixel.R>=pixel.G && pixel.G>=pixel.B) paper++;
                    }
                    if (black > total * .05 || paper < total * .5) throw new Exception("Unexpected first frame: black="+black+"; paper="+paper+"; pixels="+total);
                    long startupMilliseconds = elapsed.ElapsedMilliseconds;
                    string[] themes = { "white", "green", "dark", "paper" };
                    Color[] surfaces = { Color.FromArgb(250,250,250), Color.FromArgb(248,249,247), Color.FromArgb(36,36,36), Color.FromArgb(250,249,246) };
                    for (int i=0; i<themes.Length; i++) {
                        await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-theme-choice=\"" + themes[i] + "\"]').click()");
                        for (int wait=0; wait<100 && web.DefaultBackgroundColor.ToArgb()!=surfaces[i].ToArgb(); wait++) await Task.Delay(20);
                        if (web.DefaultBackgroundColor.ToArgb()!=surfaces[i].ToArgb() || window.BackColor.ToArgb()!=surfaces[i].ToArgb()) throw new Exception("Native surface did not follow " + themes[i]);
                        string stored = await web.CoreWebView2.ExecuteScriptAsync("JSON.parse(localStorage.getItem('yue-preferences')).theme");
                        if (stored != "\"" + themes[i] + "\"") throw new Exception("Theme was not saved: " + stored);
                    }
                    foreach (string language in L.Languages) {
                        await web.CoreWebView2.ExecuteScriptAsync("YueI18n.setLanguage(" + Program.Json.Serialize(language) + ")");
                        for(int wait=0;wait<100&&L.Language!=language;wait++)await Task.Delay(20);
                        if(L.Language!=language || window.Text!=AppRegistration.DisplayName)throw new Exception("Native language did not follow "+language);
                        string stored=await web.CoreWebView2.ExecuteScriptAsync("localStorage.getItem('yue-language')");
                        if(stored!=Program.Json.Serialize(language))throw new Exception("Language was not saved: "+stored);
                    }
                    File.WriteAllText(Path.Combine(root, "startup-result.txt"), "PASS: hidden until navigation and document-ready; correct document; warm opaque surface; first frame " + paper + "/" + total + " paper pixels, " + black + " black pixels; " + startupMilliseconds + " ms. Four themes and seven languages persist and update the native surface/title.");
                } catch (Exception error) { File.WriteAllText(Path.Combine(root, "startup-result.txt"), "FAIL: " + error); Environment.ExitCode = 1; }
                finally { window.Close(); }
            };
            window.Shown += (s, e) => timer.Start();
            Application.Run(window); timer.Dispose();
        }
    }
}
