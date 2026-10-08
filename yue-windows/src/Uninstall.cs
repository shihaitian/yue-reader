using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("卸载阅")]
[assembly: AssemblyVersion("1.2.0.0")]
namespace YueReader {
    static class UninstallProgram {
        [STAThread] static void Main(string[] args) {
            Application.EnableVisualStyles();
            try {
                if (args.Length == 2 && args[0] == "--remove") { Remove(args[1]); return; }
                string root = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar);
                using (var key = Registry.CurrentUser.OpenSubKey(AppRegistration.UninstallKey)) {
                    if (key == null || !String.Equals(root, key.GetValue("InstallLocation") as string, StringComparison.OrdinalIgnoreCase)) { MessageBox.Show(L.T("此副本未安装，无需卸载。便携版可直接移除程序文件夹。"), L.T("阅")); return; }
                }
                if (MessageBox.Show(L.T("卸载阅？\n\n原始文档和本地阅读数据会保留。"), L.T("卸载阅"), MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
                if (Process.GetProcessesByName("YueReader").Any()) { MessageBox.Show(L.T("请先关闭阅，再卸载。"), L.T("阅")); return; }
                string helper = Path.Combine(Path.GetTempPath(), "Yue-Uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
                File.Copy(Application.ExecutablePath, helper);
                Process.Start(new ProcessStartInfo(helper, "--remove \"" + root + "\"") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
            } catch (Exception error) { MessageBox.Show(error.Message, L.T("无法卸载阅"), MessageBoxButtons.OK, MessageBoxIcon.Information); }
        }
        static void Remove(string directory) {
            string root = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            using (var key = Registry.CurrentUser.OpenSubKey(AppRegistration.UninstallKey)) {
                if (key == null || !String.Equals(root.TrimEnd(Path.DirectorySeparatorChar), key.GetValue("InstallLocation") as string, StringComparison.OrdinalIgnoreCase)) throw new IOException(L.T("安装位置不匹配。"));
            }
            if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) throw new IOException(L.T("安装目录是链接，无法自动卸载。"));
            string manifest = Path.Combine(root, "installed-files.txt");
            if (!File.Exists(manifest)) throw new IOException(L.T("安装清单缺失，请重新安装后卸载。"));
            string[] files = File.ReadAllLines(manifest);
            Thread.Sleep(800);
            foreach (string relative in files) {
                if (String.IsNullOrWhiteSpace(relative)) continue;
                string file = Path.GetFullPath(Path.Combine(root, relative));
                if (!file.StartsWith(root, StringComparison.OrdinalIgnoreCase) || relative.Contains(":")) throw new IOException(L.T("安装清单路径无效。"));
                string ancestor = Path.GetDirectoryName(file);
                while (ancestor.Length >= root.TrimEnd(Path.DirectorySeparatorChar).Length) {
                    if (Directory.Exists(ancestor) && (File.GetAttributes(ancestor) & FileAttributes.ReparsePoint) != 0) throw new IOException(L.T("安装目录中存在链接，无法自动卸载。"));
                    ancestor = Path.GetDirectoryName(ancestor); if (String.IsNullOrEmpty(ancestor)) break;
                }
                if (File.Exists(file)) File.Delete(file);
            }
            AppRegistration.Unregister(Path.Combine(root, "YueReader.exe"));
            Registry.CurrentUser.DeleteSubKeyTree(AppRegistration.UninstallKey, false);
            string menu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "阅");
            foreach (string shortcut in new[] { Path.Combine(menu, "阅.lnk"), Path.Combine(menu, "卸载阅.lnk"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "阅.lnk") }) if (File.Exists(shortcut)) File.Delete(shortcut);
            if (Directory.Exists(menu) && !Directory.EnumerateFileSystemEntries(menu).Any()) Directory.Delete(menu);
            // Only remove directories proven empty. Never recursively delete installation or user data.
            foreach (string dir in Directory.GetDirectories(root, "*", SearchOption.AllDirectories).OrderByDescending(d => d.Length)) if (!Directory.EnumerateFileSystemEntries(dir).Any()) Directory.Delete(dir);
            if (!Directory.EnumerateFileSystemEntries(root).Any()) Directory.Delete(root);
            MessageBox.Show(L.T("阅已卸载，原始文档和阅读数据已保留。"), L.T("阅"));
        }
    }
}
