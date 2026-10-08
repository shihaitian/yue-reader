using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]

namespace YueReader {
    public static class ReaderFiles {
        public const long MaxDocumentBytes = 5 * 1024 * 1024;
        public static readonly string[] Extensions = { ".md", ".markdown", ".mdown", ".mkd" };
        public static bool IsDocument(string file) {
            string ext = Path.GetExtension(file);
            return Extensions.Contains(ext, StringComparer.OrdinalIgnoreCase) || ext.Equals(".txt", StringComparison.OrdinalIgnoreCase);
        }
        public static string Decode(byte[] bytes) {
            if (bytes.Length >= 2 && bytes[0] == 255 && bytes[1] == 254) return Encoding.Unicode.GetString(bytes, 2, bytes.Length - 2);
            if (bytes.Length >= 2 && bytes[0] == 254 && bytes[1] == 255) return Encoding.BigEndianUnicode.GetString(bytes, 2, bytes.Length - 2);
            int skip = bytes.Length >= 3 && bytes[0] == 239 && bytes[1] == 187 && bytes[2] == 191 ? 3 : 0;
            try { return new UTF8Encoding(false, true).GetString(bytes, skip, bytes.Length - skip); }
            catch (DecoderFallbackException) { return Encoding.GetEncoding(54936).GetString(bytes); }
        }
        public static string DocumentId(string path) {
            using (var hash = SHA256.Create()) return "win-" + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(Path.GetFullPath(path).ToUpperInvariant()))).Replace("-", "").ToLowerInvariant();
        }
        public static string ReadDocument(string path) {
            if (!IsDocument(path)) throw new IOException(L.T("请选择 Markdown 或 TXT 文档。"));
            var info = new FileInfo(path);
            if (!info.Exists) throw new FileNotFoundException(L.T("文档已被移动或删除：") + Path.GetFileName(path));
            if (info.Length > MaxDocumentBytes) throw new IOException(L.T("单个文档不能超过 5 MB。"));
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
                if (stream.Length > MaxDocumentBytes) throw new IOException(L.T("单个文档不能超过 5 MB。"));
                using (var memory = new MemoryStream()) {
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = stream.Read(buffer, 0, buffer.Length)) > 0) {
                        if (memory.Length + count > MaxDocumentBytes) throw new IOException(L.T("单个文档不能超过 5 MB。"));
                        memory.Write(buffer, 0, count);
                    }
                    return Decode(memory.ToArray());
                }
            }
        }
        public static string ResolveRelative(string documentPath, string relative) {
            string value = Uri.UnescapeDataString(relative.Split('#')[0].Split('?')[0]).Replace('/', Path.DirectorySeparatorChar);
            if (String.IsNullOrWhiteSpace(value) || Path.IsPathRooted(value) || value.Contains(":")) throw new IOException(L.T("仅能读取文档目录内的相对路径。"));
            string root = Path.GetFullPath(Path.GetDirectoryName(documentPath)).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string result = Path.GetFullPath(Path.Combine(root, value));
            if (!result.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new IOException(L.T("文件位于文档目录之外，请单独打开。"));
            string current = result;
            while (current.Length >= root.TrimEnd(Path.DirectorySeparatorChar).Length) {
                if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new IOException(L.T("请直接打开链接文件所在的目录。"));
                current = Path.GetDirectoryName(current);
                if (String.IsNullOrEmpty(current)) break;
            }
            return result;
        }
        public static string ImageMime(string path) {
            switch (Path.GetExtension(path).ToLowerInvariant()) {
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".gif": return "image/gif";
                case ".webp": return "image/webp";
                case ".avif": return "image/avif";
                case ".bmp": return "image/bmp";
                case ".svg": return "image/svg+xml";
                default: throw new IOException(L.T("不支持此图片格式。"));
            }
        }
    }
    public sealed class RegistryEntry {
        public string Key, Name, Value;
        public bool EmptyBinary;
        public RegistryEntry(string key, string name, string value, bool binary = false) { Key = key; Name = name; Value = value; EmptyBinary = binary; }
    }
    public static class AppRegistration {
        public const string AppName = "YueReader";
        public const string ProgId = "YueReader.Markdown";
        public static string DisplayName { get { return L.T("阅 · Markdown 阅读器"); } }
        public const string Capabilities = @"Software\YueReader\Capabilities";
        public const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\YueReader";
        public const string DefaultSettingsUri = "ms-settings:defaultapps?registeredAppUser=YueReader";
        public static string OpenCommand(string exe) { return "\"" + Path.GetFullPath(exe) + "\" \"%1\""; }
        public static List<RegistryEntry> Plan(string executable) {
            string exe = Path.GetFullPath(executable);
            string icon = "\"" + exe + "\",0";
            var entries = new List<RegistryEntry> {
                new RegistryEntry(@"Software\Classes\" + ProgId, "", "Markdown 文档"),
                new RegistryEntry(@"Software\Classes\" + ProgId, "FriendlyTypeName", "Markdown 文档"),
                new RegistryEntry(@"Software\Classes\" + ProgId + @"\DefaultIcon", "", icon),
                new RegistryEntry(@"Software\Classes\" + ProgId + @"\shell\open\command", "", OpenCommand(exe)),
                new RegistryEntry(@"Software\Classes\Applications\YueReader.exe", "FriendlyAppName", DisplayName),
                new RegistryEntry(@"Software\Classes\Applications\YueReader.exe\DefaultIcon", "", icon),
                new RegistryEntry(@"Software\Classes\Applications\YueReader.exe\shell\open\command", "", OpenCommand(exe)),
                new RegistryEntry(Capabilities, "ApplicationName", DisplayName),
                new RegistryEntry(Capabilities, "ApplicationDescription", L.T("简洁、轻量的 Markdown 阅读器")),
                new RegistryEntry(Capabilities, "ApplicationIcon", icon),
                new RegistryEntry(@"Software\RegisteredApplications", AppName, Capabilities)
            };
            foreach (string ext in ReaderFiles.Extensions) {
                entries.Add(new RegistryEntry(@"Software\Classes\Applications\YueReader.exe\SupportedTypes", ext, ""));
                entries.Add(new RegistryEntry(@"Software\Classes\" + ext + @"\OpenWithProgids", ProgId, "", true));
                entries.Add(new RegistryEntry(Capabilities + @"\FileAssociations", ext, ProgId));
            }
            return entries;
        }
        public static void Register(string executable) {
            foreach (RegistryEntry entry in Plan(executable)) using (RegistryKey key = Registry.CurrentUser.CreateSubKey(entry.Key)) {
                if (entry.EmptyBinary) key.SetValue(entry.Name, new byte[0], RegistryValueKind.None);
                else key.SetValue(entry.Name, entry.Value, RegistryValueKind.String);
            }
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
        }
        public static bool IsOurs(string executable) {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Classes\" + ProgId + @"\shell\open\command"))
                return key != null && String.Equals(key.GetValue("") as string, OpenCommand(executable), StringComparison.OrdinalIgnoreCase);
        }
        public static void Unregister(string executable) {
            if (!IsOurs(executable)) return;
            foreach (string ext in ReaderFiles.Extensions) using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Classes\" + ext + @"\OpenWithProgids", true)) { if (key != null) key.DeleteValue(ProgId, false); }
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\" + ProgId, false);
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\Applications\YueReader.exe", false);
            Registry.CurrentUser.DeleteSubKeyTree(Capabilities, false);
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\RegisteredApplications", true)) { if (key != null && (key.GetValue(AppName) as string) == Capabilities) key.DeleteValue(AppName, false); }
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
        }
        [DllImport("shell32.dll")] static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
    }
}
