using System;
using System.Globalization;
using System.IO;
using System.Collections.Generic;

namespace YueReader {
    public static partial class L {
        public static readonly string[] Languages = { "zh-CN", "en", "es", "fr", "de", "ja", "pt-BR" };
        public static readonly string[] LanguageNames = { "简体中文", "English", "Español", "Français", "Deutsch", "日本語", "Português" };
        public static string Language = InitialLanguage();
        static string PreferencePath {
            get { return Path.Combine(Environment.GetEnvironmentVariable("YUE_READER_DATA") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "YueReader"), "language.txt"); }
        }
        static string InitialLanguage() {
            try { if (File.Exists(PreferencePath)) return Normalize(File.ReadAllText(PreferencePath).Trim()); } catch { }
            return Normalize(CultureInfo.CurrentUICulture.Name);
        }
        public static string Normalize(string language) {
            string primary = (language ?? "en").Split('-')[0].ToLowerInvariant();
            foreach (string candidate in Languages) if (candidate.Split('-')[0] == primary) return candidate;
            return "en";
        }
        public static void SetLanguage(string language, bool persist) {
            Language = Normalize(language);
            if (persist) try { Directory.CreateDirectory(Path.GetDirectoryName(PreferencePath)); File.WriteAllText(PreferencePath, Language); } catch { }
        }
        public static string T(string text) {
            string[] translations;
            if (!Translations.TryGetValue(text, out translations)) return text;
            int index = Array.IndexOf(Languages, Language);
            return translations[index < 0 ? 1 : index];
        }
    }
}
