using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: System.Reflection.AssemblyTitle("阅 · Markdown 阅读器")]
[assembly: System.Reflection.AssemblyDescription("轻量 Windows Markdown 阅读器")]
[assembly: System.Reflection.AssemblyProduct("阅")]
[assembly: System.Reflection.AssemblyCompany("Yue Reader")]
[assembly: System.Reflection.AssemblyVersion("1.2.1.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.2.1.0")]

namespace YueReader {
    static class Program {
        static Mutex instance;
        public static string PipeName;
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 24 * 1024 * 1024 };
        [STAThread] static void Main(string[] args) {
            // Set the opaque browser surface before WebView2 creates its controller.
            // This is process-local; it does not change Windows or other applications.
            Environment.SetEnvironmentVariable("WEBVIEW2_DEFAULT_BACKGROUND_COLOR", "FFFAF9F6", EnvironmentVariableTarget.Process);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try {
                SetCurrentProcessExplicitAppUserModelID("YueReader.Desktop");
                string user = WindowsIdentity.GetCurrent().User.Value;
                string testData = Environment.GetEnvironmentVariable("YUE_READER_DATA");
                PipeName = "YueReader-" + user + (String.IsNullOrEmpty(testData) ? "" : "-" + ReaderFiles.DocumentId(testData));
                bool first;
                instance = new Mutex(true, @"Local\" + PipeName, out first);
                if (!first) {
                    if (Forward(args)) return;
                    MessageBox.Show(L.T("阅正在启动，请稍后再次打开文档。"), L.T("阅"), MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                Application.Run(new ReaderWindow(args));
            } catch (Exception error) {
                MessageBox.Show(L.T("无法启动阅：\n") + error.Message, L.T("阅"), MessageBoxButtons.OK, MessageBoxIcon.Error);
            } finally { if (instance != null) instance.Dispose(); }
        }
        static bool Forward(string[] args) {
            for (int attempt = 0; attempt < 4; attempt++) {
                try {
                    using (var pipe = new NamedPipeClientStream(".", PipeName, PipeDirection.Out)) {
                        pipe.Connect(900);
                        using (var writer = new StreamWriter(pipe, new UTF8Encoding(false))) { writer.WriteLine(Json.Serialize(args)); writer.Flush(); }
                    }
                    return true;
                } catch (IOException) { Thread.Sleep(150); }
                catch (TimeoutException) { Thread.Sleep(150); }
            }
            return false;
        }
        [DllImport("shell32.dll")] static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string appId);
    }
    class ReaderWindow : Form {
        readonly WebView2 web = new WebView2();
        readonly Queue<string[]> pending = new Queue<string[]>();
        readonly Dictionary<string, string> documents = new Dictionary<string, string>();
        bool pageReady, closing, navigationReady, viewReady, viewRevealed;
        NamedPipeServerStream pipeServer;
        const string Origin = "https://yue.local";
        readonly string uiPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui");
        readonly Label loading = new Label();
        public ReaderWindow(string[] args) {
            SuspendLayout();
            AutoScaleDimensions = new SizeF(96F, 96F);
            AutoScaleMode = AutoScaleMode.Dpi;
            Text = AppRegistration.DisplayName;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1280, 860); MinimumSize = new Size(720, 500);
            BackColor = Color.FromArgb(250, 249, 246);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            loading.Text = L.T("阅\n\n正在准备你的阅读空间…");
            loading.Dock = DockStyle.Fill; loading.TextAlign = ContentAlignment.MiddleCenter;
            loading.Font = new Font("Microsoft YaHei UI", 16); loading.ForeColor = Color.FromArgb(116, 113, 102);
            loading.BackColor = BackColor;
            Controls.Add(loading);
            web.Dock = DockStyle.Fill; web.DefaultBackgroundColor = BackColor; web.Visible = false;
            Controls.Add(web); loading.BringToFront();
            pending.Enqueue(args);
            Shown += async (s, e) => { Listen(); await Initialize(); };
            FormClosed += (s, e) => { closing = true; if (pipeServer != null) pipeServer.Dispose(); web.Dispose(); };
            ResumeLayout(true);
        }
        protected override void OnLoad(EventArgs e) {
            base.OnLoad(e);
            // Keep the correctly scaled window within the current monitor's work area.
            Rectangle area = Screen.FromControl(this).WorkingArea;
            MinimumSize = new Size(Math.Min(MinimumSize.Width, area.Width), Math.Min(MinimumSize.Height, area.Height));
            Size = new Size(Math.Min(Width, (int)(area.Width * .92)), Math.Min(Height, (int)(area.Height * .92)));
            Location = new Point(area.Left + (area.Width - Width) / 2, area.Top + (area.Height - Height) / 2);
        }
        bool Trusted(string value) {
            Uri uri;
            return Uri.TryCreate(value, UriKind.Absolute, out uri) && uri.Scheme == "https" && uri.Host == "yue.local" && uri.IsDefaultPort;
        }
        async Task Initialize() {
            try {
                if (!File.Exists(Path.Combine(uiPath, "index.html"))) throw new IOException(L.T("缺少界面文件。请重新解压或安装完整程序。"));
                string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                string customData = Environment.GetEnvironmentVariable("YUE_READER_DATA");
                string data = String.IsNullOrEmpty(customData) ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YueReader", "WebView2") : Path.GetFullPath(customData);
                var environment = await CoreWebView2Environment.CreateAsync(null, data, new CoreWebView2EnvironmentOptions());
                await web.EnsureCoreWebView2Async(environment);
                var core = web.CoreWebView2;
                core.SetVirtualHostNameToFolderMapping("yue.local", uiPath, CoreWebView2HostResourceAccessKind.DenyCors);
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsWebMessageEnabled = true;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.PermissionRequested += (s, e) => { e.State = CoreWebView2PermissionState.Deny; };
                core.NavigationStarting += (s, e) => {
                    if (!Trusted(e.Uri)) { e.Cancel = true; if (e.IsUserInitiated) OpenExternal(e.Uri); }
                };
                core.NewWindowRequested += (s, e) => { e.Handled = true; if (e.IsUserInitiated) OpenExternal(e.Uri); };
                core.DocumentTitleChanged += (s, e) => { Text = core.DocumentTitle; };
                core.WebMessageReceived += OnMessage;
                await core.AddScriptToExecuteOnDocumentCreatedAsync("try { if (!localStorage.getItem('yue-language')) localStorage.setItem('yue-language', " + Program.Json.Serialize(L.Language) + "); } catch {}");
                core.NavigationCompleted += (s, e) => { if (e.IsSuccess) { navigationReady = true; RevealWhenReady(); } else ShowFailure(L.T("界面加载失败：") + e.WebErrorStatus); };
                core.ProcessFailed += (s, e) => { if (!closing && e.ProcessFailedKind != CoreWebView2ProcessFailedKind.BrowserProcessExited) ShowFailure(L.T("阅读窗口需要重新打开。请关闭阅后重试。")); };
                core.Navigate(Origin + "/index.html");
            } catch (WebView2RuntimeNotFoundException) {
                web.Visible = false;
                loading.Text = L.T("需要 Microsoft Edge WebView2 运行时\n\n安装后即可使用阅。");
                if (MessageBox.Show(L.T("这台电脑尚未安装 WebView2 运行时。是否打开微软官方下载页面？"), L.T("阅"), MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes) OpenExternal("https://developer.microsoft.com/microsoft-edge/webview2/");
            } catch (Exception error) { ShowFailure(L.T("无法加载阅读界面：\n") + error.Message); }
        }
        void RevealWhenReady() {
            if (closing || viewRevealed || !navigationReady || !viewReady) return;
            viewRevealed = true;
            web.Visible = true; web.BringToFront(); loading.Visible = false;
        }
        void SetSurfaceTheme(string theme) {
            Color surface = theme == "dark" ? Color.FromArgb(36, 36, 36) : theme == "green" ? Color.FromArgb(248, 249, 247) : theme == "white" ? Color.FromArgb(250, 250, 250) : Color.FromArgb(250, 249, 246);
            BackColor = loading.BackColor = web.DefaultBackgroundColor = surface;
        }
        void ShowFailure(string text) { if (closing) return; web.Visible = false; loading.Visible = true; loading.BringToFront(); loading.Text = text; }
        async void Listen() {
            while (!closing) {
                try {
                    var security = new PipeSecurity();
                    security.SetAccessRuleProtection(true, false);
                    security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
                    using (var pipe = new NamedPipeServerStream(Program.PipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 65536, 65536, security)) {
                        pipeServer = pipe;
                        await Task.Factory.FromAsync(pipe.BeginWaitForConnection, pipe.EndWaitForConnection, null);
                        using (var reader = new StreamReader(pipe, Encoding.UTF8)) {
                            char[] buffer = new char[32769]; int length = 0;
                            while (length < buffer.Length) { int count = await reader.ReadAsync(buffer, length, buffer.Length - length); if (count == 0) break; length += count; }
                            if (length > 32768) continue;
                            string[] args = Program.Json.Deserialize<string[]>(new string(buffer, 0, length));
                            if (args != null) { pending.Enqueue(args); Show(); if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal; Activate(); await Drain(); }
                        }
                    }
                } catch (ObjectDisposedException) { break; }
                catch (IOException) { }
                catch (Exception) { }
                finally { pipeServer = null; }
                if (!closing) await Task.Delay(100);
            }
        }
        async Task Drain() {
            if (!pageReady) return;
            while (pending.Count > 0) await OpenFiles(pending.Dequeue());
        }
        void Send(object value) { if (!closing && pageReady && web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(Program.Json.Serialize(value)); }
        async Task OpenFiles(IEnumerable<string> paths) {
            var result = new List<object>();
            foreach (string raw in paths.Take(50)) {
                if (String.IsNullOrWhiteSpace(raw)) continue;
                try {
                    string file = Path.GetFullPath(raw);
                    string content = await Task.Run(() => ReaderFiles.ReadDocument(file));
                    string id = ReaderFiles.DocumentId(file);
                    documents[id] = file;
                    result.Add(new { id, name = Path.GetFileName(file), path = file.Replace('\\', '/'), content });
                } catch (Exception error) { Send(new { type = "notice", message = error.Message }); }
            }
            if (result.Count > 0) Send(new { type = "open-documents", documents = result });
        }
        async void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args) {
            if (!Trusted(args.Source)) return;
            try {
                var data = Program.Json.Deserialize<Dictionary<string, object>>(args.WebMessageAsJson);
                string type = Get(data, "type");
                if (type == "ready") { L.SetLanguage(Get(data, "language"), true); Text = AppRegistration.DisplayName; pageReady = true; await Drain(); Send(new { type = "prepare-view" }); }
                else if (type == "view-ready") { SetSurfaceTheme(Get(data, "theme")); viewReady = true; RevealWhenReady(); }
                else if (type == "language-changed") { L.SetLanguage(Get(data, "language"), true); Text = AppRegistration.DisplayName; }
                else if (type == "website") { OpenExternal("https://yue-markdown-shiha.txqy0831.chatgpt.site/?lang=" + L.Language); }
                else if (type == "theme-changed") { SetSurfaceTheme(Get(data, "theme")); }
                else if (type == "view-error") ShowFailure(L.T("无法准备阅读界面，请关闭后重新打开。"));
                else if (type == "open") {
                    using (var dialog = new OpenFileDialog { Filter = L.T("Markdown 文档|*.md;*.markdown;*.mdown;*.mkd|文本文件|*.txt"), Multiselect = true, Title = L.T("打开文档 · 阅"), CheckFileExists = true })
                        if (dialog.ShowDialog(this) == DialogResult.OK) await OpenFiles(dialog.FileNames);
                } else if (type == "defaults") {
                    AppRegistration.Register(Application.ExecutablePath);
                    Process.Start(new ProcessStartInfo(AppRegistration.DefaultSettingsUri) { UseShellExecute = true });
                } else if (type == "image") await LoadImage(data);
                else if (type == "open-relative") {
                    string document;
                    if (documents.TryGetValue(Get(data, "docId"), out document)) await OpenFiles(new[] { ReaderFiles.ResolveRelative(document, Get(data, "src")) });
                    else Send(new { type = "notice", message = L.T("请重新打开原文档以访问本地链接。") });
                }
            } catch (Exception error) { Send(new { type = "notice", message = error.Message }); }
        }
        async Task LoadImage(Dictionary<string, object> data) {
            string requestId = Get(data, "requestId");
            try {
                string document;
                if (!documents.TryGetValue(Get(data, "docId"), out document)) throw new IOException(L.T("请重新打开原文档以加载图片。"));
                string path = ReaderFiles.ResolveRelative(document, Get(data, "src"));
                string mime = ReaderFiles.ImageMime(path);
                var info = new FileInfo(path);
                if (!info.Exists || info.Length > 15 * 1024 * 1024) throw new IOException(L.T("图片不存在或大于 15 MB。"));
                byte[] bytes = await Task.Run(() => File.ReadAllBytes(path));
                Send(new { type = "image", requestId, mime, bytes = Convert.ToBase64String(bytes) });
            } catch (Exception error) { Send(new { type = "image", requestId, error = error.Message }); }
        }
        static string Get(Dictionary<string, object> data, string key) { object value; return data.TryGetValue(key, out value) ? Convert.ToString(value) : ""; }
        void OpenExternal(string value) {
            Uri uri;
            if (!Uri.TryCreate(value, UriKind.Absolute, out uri) || !(uri.Scheme == "https" || uri.Scheme == "http" || uri.Scheme == "mailto")) return;
            try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
            catch (Exception error) { MessageBox.Show(error.Message, L.T("无法打开链接"), MessageBoxButtons.OK, MessageBoxIcon.Information); }
        }
    }
}
