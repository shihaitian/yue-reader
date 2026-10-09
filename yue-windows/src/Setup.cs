using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("阅 · Windows 安装程序")]
[assembly: AssemblyProduct("阅")]
[assembly: AssemblyCompany("Yue Reader")]
[assembly: AssemblyVersion("1.2.2.0")]
[assembly: AssemblyFileVersion("1.2.2.0")]

namespace YueReader {
    public static class SetupPayload {
        public static string Destination { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "YueReader"); } }
        public static void Extract(string destination) {
            string root = Path.GetFullPath(destination).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            Directory.CreateDirectory(root);
            using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("Yue.Payload"))
            using (var archive = new ZipArchive(resource, ZipArchiveMode.Read)) {
                foreach (ZipArchiveEntry entry in archive.Entries) {
                    string relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    string file = Path.GetFullPath(Path.Combine(root, relative));
                    if (!file.StartsWith(root, StringComparison.OrdinalIgnoreCase) || relative.Contains(":")) throw new IOException(L.T("安装包含有无效路径。"));
                    if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(file); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(file));
                    using (var input = entry.Open()) using (var output = new FileStream(file, FileMode.Create, FileAccess.Write, FileShare.None)) input.CopyTo(output);
                }
            }
        }
        public static void Shortcut(string target, string shortcutPath) {
            Type type = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(type);
            object link = type.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
            Type linkType = link.GetType();
            linkType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { target });
            linkType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link, new object[] { Path.GetDirectoryName(target) });
            linkType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, link, new object[] { target + ",0" });
            linkType.InvokeMember("Description", BindingFlags.SetProperty, null, link, new object[] { AppRegistration.DisplayName });
            linkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
            System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link);
            System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
        }
        public static void Install(bool register, bool desktop) {
            string root = Destination;
            string exe = Path.Combine(root, "YueReader.exe");
            foreach (Process process in Process.GetProcessesByName("YueReader")) {
                try { if (String.Equals(process.MainModule.FileName, exe, StringComparison.OrdinalIgnoreCase)) throw new IOException(L.T("请先关闭正在运行的阅，再点击安装。")); }
                catch (System.ComponentModel.Win32Exception) { }
                finally { process.Dispose(); }
            }
            if (Directory.Exists(root) && (File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) throw new IOException(L.T("安装目录是链接，请选择正常的安装环境。"));
            Extract(root);
            if (register) AppRegistration.Register(exe);
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(AppRegistration.UninstallKey)) {
                key.SetValue("DisplayName", AppRegistration.DisplayName);
                key.SetValue("DisplayVersion", "1.2.2");
                key.SetValue("Publisher", "Yue Reader");
                key.SetValue("InstallLocation", root);
                key.SetValue("DisplayIcon", exe + ",0");
                key.SetValue("UninstallString", "\"" + Path.Combine(root, "Uninstall.exe") + "\"");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("EstimatedSize", (int)(Directory.GetFiles(root, "*", SearchOption.AllDirectories).Sum(f => new FileInfo(f).Length) / 1024), RegistryValueKind.DWord);
            }
            string menu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "阅");
            Directory.CreateDirectory(menu);
            Shortcut(exe, Path.Combine(menu, "阅.lnk"));
            Shortcut(Path.Combine(root, "Uninstall.exe"), Path.Combine(menu, "卸载阅.lnk"));
            if (desktop) Shortcut(exe, Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "阅.lnk"));
        }
    }
    static class SetupProgram {
        [STAThread] static void Main(string[] args) {
            // Verification extracts into an explicitly provided scratch folder; no registry or shortcuts are touched.
            if (args.Length == 2 && args[0] == "--verify-extract") {
                try { SetupPayload.Extract(args[1]); Environment.ExitCode = 0; } catch { Environment.ExitCode = 1; }
                return;
            }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupWindow());
        }
    }
    class SetupWindow : Form {
        readonly CheckBox associate = new CheckBox(), desktop = new CheckBox();
        readonly Button install = new Button(), open = new Button(), defaults = new Button();
        readonly Label note = new Label();
        readonly ComboBox language = new ComboBox();
        readonly Label languageLabel = new Label();
        Label title, description, location;
        bool working, installed;
        public SetupWindow() {
            SuspendLayout();
            // Bounds are designed at 96 DPI. Without this baseline WinForms leaves them
            // at physical-pixel sizes while the text follows the monitor's scaling.
            AutoScaleDimensions = new SizeF(96F, 96F);
            AutoScaleMode = AutoScaleMode.Dpi;
            Text = L.T("安装"); ClientSize = new Size(660, 600); FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Microsoft YaHei UI", 10); BackColor = Color.FromArgb(250, 249, 246);
            ForeColor = Color.FromArgb(61, 56, 48);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            var layout = new TableLayoutPanel { Name = "Layout", Dock = DockStyle.Fill, Padding = new Padding(32, 28, 32, 24), ColumnCount = 1, RowCount = 8 };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            for (int i = 0; i < 8; i++) layout.RowStyles.Add(new RowStyle(i == 6 ? SizeType.Percent : SizeType.AutoSize, i == 6 ? 100 : 0));
            var header = new TableLayoutPanel { AutoSize = true, Dock = DockStyle.Top, ColumnCount = 2, RowCount = 2, Margin = new Padding(0, 0, 0, 22) };
            header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 68));
            header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            var logo = new PictureBox { Image = Icon.ToBitmap(), Size = new Size(48, 48), Margin = new Padding(0, 5, 20, 0), SizeMode = PictureBoxSizeMode.Zoom };
            title = new Label { Name = "Title", Text = L.T("让阅读，回归简单。"), AutoSize = true, Dock = DockStyle.Fill, Margin = new Padding(0, 0, 0, 6), Font = new Font(Font.FontFamily, 20, FontStyle.Bold) };
            var subtitle = new Label { Text = "Yue 1.2.2  ·  Windows 10 / 11 · x64", AutoSize = true, Dock = DockStyle.Fill, Margin = Padding.Empty, ForeColor = Color.FromArgb(129, 120, 106) };
            header.Controls.Add(logo, 0, 0); header.SetRowSpan(logo, 2);
            header.Controls.Add(title, 1, 0); header.Controls.Add(subtitle, 1, 1);
            layout.Controls.Add(header, 0, 0);
            description = TextLabel(L.T("安装后，双击 Markdown 就能轻松阅读。\n无需管理员权限，文档保留在你的电脑里。"), 22);
            layout.Controls.Add(description, 0, 1);
            associate.Name = "Associate"; associate.Text = L.T("添加到 Markdown 的“打开方式”列表"); associate.Checked = true;
            associate.AutoSize = true; associate.Dock = DockStyle.Top; associate.Margin = new Padding(0, 0, 0, 10);
            desktop.Name = "Desktop"; desktop.Text = L.T("创建桌面快捷方式"); desktop.Checked = true;
            desktop.AutoSize = true; desktop.Dock = DockStyle.Top; desktop.Margin = new Padding(0, 0, 0, 22);
            layout.Controls.Add(associate, 0, 2); layout.Controls.Add(desktop, 0, 3);
            location = TextLabel(L.T("安装位置") + "\n" + SetupPayload.Destination, 16);
            location.Name = "Location"; location.ForeColor = Color.FromArgb(129, 120, 106);
            layout.Controls.Add(location, 0, 4);
            note.Name = "Note"; note.Text = L.T("默认打开方式由你在 Windows 设置中选择。");
            note.AutoSize = true; note.Dock = DockStyle.Fill; note.Margin = Padding.Empty; note.ForeColor = Color.FromArgb(116, 113, 102);
            layout.Controls.Add(note, 0, 5);
            var languageRow = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Top, Margin = new Padding(0, 18, 0, 0), WrapContents = false };
            languageLabel.AutoSize = true; languageLabel.Text = L.T("语言"); languageLabel.Margin = new Padding(0, 7, 18, 0);
            language.DropDownStyle = ComboBoxStyle.DropDownList; language.Width = 220; language.Name = "Language";
            language.Items.AddRange(L.LanguageNames); language.SelectedIndex = Array.IndexOf(L.Languages, L.Language);
            language.SelectedIndexChanged += (s, e) => { if (language.SelectedIndex >= 0) { L.SetLanguage(L.Languages[language.SelectedIndex], false); ApplyLanguage(); } };
            languageRow.Controls.AddRange(new Control[] { languageLabel, language }); layout.Controls.Add(languageRow, 0, 6);
            var actions = new FlowLayoutPanel { Name = "Actions", AutoSize = true, Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, WrapContents = false, Margin = new Padding(0, 20, 0, 0) };
            install.Name = "Install"; install.Text = L.T("安装"); StylePrimary(install); install.Click += Install;
            open.Name = "Open"; open.Text = L.T("打开阅"); StylePrimary(open); open.Visible = false;
            open.Click += (s, e) => { Process.Start(Path.Combine(SetupPayload.Destination, "YueReader.exe")); Close(); };
            defaults.Name = "Defaults"; defaults.Text = L.T("设置默认打开方式"); StyleButton(defaults); defaults.Margin = new Padding(0, 0, 12, 0); defaults.Visible = false;
            defaults.Click += (s, e) => { AppRegistration.Register(Path.Combine(SetupPayload.Destination, "YueReader.exe")); Process.Start(new ProcessStartInfo(AppRegistration.DefaultSettingsUri) { UseShellExecute = true }); };
            actions.Controls.AddRange(new Control[] { install, open, defaults });
            layout.Controls.Add(actions, 0, 7); Controls.Add(layout);
            AcceptButton = install;
            FormClosing += (s, e) => { if (working) e.Cancel = true; };
            ResumeLayout(true);
        }
        void ApplyLanguage() {
            Text = L.T("安装"); title.Text = L.T("让阅读，回归简单。");
            description.Text = L.T("安装后，双击 Markdown 就能轻松阅读。\n无需管理员权限，文档保留在你的电脑里。");
            associate.Text = L.T("添加到 Markdown 的“打开方式”列表"); desktop.Text = L.T("创建桌面快捷方式");
            location.Text = L.T("安装位置") + "\n" + SetupPayload.Destination;
            note.Text = L.T(installed ? "安装完成。可将 .md 的默认应用选为“阅”。" : "默认打开方式由你在 Windows 设置中选择。");
            install.Text = L.T("安装"); open.Text = L.T("打开阅"); defaults.Text = L.T("设置默认打开方式"); languageLabel.Text = L.T("语言");
            if (installed) L.SetLanguage(L.Language, true);
        }
        Label TextLabel(string text, int bottomMargin) { return new Label { Text = text, AutoSize = true, Dock = DockStyle.Fill, Margin = new Padding(0, 0, 0, bottomMargin) }; }
        void StyleButton(Button button) { button.AutoSize = true; button.MinimumSize = new Size(126, 44); button.Padding = new Padding(18, 8, 18, 8); button.Margin = Padding.Empty; button.Cursor = Cursors.Hand; }
        void StylePrimary(Button button) { StyleButton(button); button.BackColor = Color.FromArgb(116, 113, 102); button.ForeColor = Color.White; button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderSize = 0; }
        async void Install(object sender, EventArgs args) {
            working = true; install.Enabled = false; associate.Enabled = desktop.Enabled = language.Enabled = false;
            bool register = associate.Checked, shortcut = desktop.Checked;
            note.Text = L.T("正在安装…");
            try {
                await Task.Run(() => SetupPayload.Install(register, shortcut));
                installed = true; L.SetLanguage(L.Language, true);
                note.Text = L.T("安装完成。可将 .md 的默认应用选为“阅”。");
                install.Visible = false; open.Visible = defaults.Visible = true;
                AcceptButton = open;
            } catch (Exception error) { MessageBox.Show(error.Message, L.T("暂时无法安装"), MessageBoxButtons.OK, MessageBoxIcon.Information); note.Text = L.T("请解决提示的问题后重试。"); install.Enabled = associate.Enabled = desktop.Enabled = true; }
            finally { working = false; language.Enabled = true; }
        }
    }
}
