using System;
using System.IO;
using System.Linq;
using System.Text;
using YueReader;
class Tests {
    static int passed;
    static void Check(bool test, string message) { if (!test) throw new Exception(message); passed++; Console.WriteLine("PASS " + message); }
    static void Reject(Action action, string message) { bool rejected=false; try { action(); } catch (IOException) { rejected=true; } Check(rejected,message); }
    static void Main(string[] args) {
        string root = Path.GetFullPath(args[0]); Directory.CreateDirectory(root);
        string doc = Path.Combine(root,"中文 空格 & 文件.md");
        File.WriteAllText(doc,"# 你好\n\nWindows 文件关联。",new UTF8Encoding(true));
        Check(ReaderFiles.ReadDocument(doc).StartsWith("# 你好"),"UTF-8 BOM / Unicode path");
        Check(ReaderFiles.Decode(Encoding.GetEncoding(54936).GetBytes("中文阅读"))=="中文阅读","GB18030 decode");
        Check(ReaderFiles.Decode(new byte[]{255,254,0x2d,0x4e,0x87,0x65})=="中文","UTF-16 decode");
        Check(ReaderFiles.DocumentId(doc)==ReaderFiles.DocumentId(doc.ToUpperInvariant()),"Case-insensitive stable document identity");
        Check(ReaderFiles.IsDocument("README.MD") && !ReaderFiles.IsDocument("script.exe"),"Document extension allowlist");
        Check(ReaderFiles.ResolveRelative(doc,"images/封面.png")==Path.Combine(root,"images","封面.png"),"Relative images resolve inside document folder");
        Reject(()=>ReaderFiles.ResolveRelative(doc,"../private.png"),"Reject parent traversal");
        Reject(()=>ReaderFiles.ResolveRelative(doc,"%2e%2e/private.png"),"Reject encoded traversal");
        Reject(()=>ReaderFiles.ResolveRelative(doc,"C:/Windows/private.png"),"Reject absolute local paths");
        Reject(()=>ReaderFiles.ResolveRelative(doc,"image.png:secret"),"Reject NTFS alternate streams");
        Reject(()=>ReaderFiles.ImageMime("settings.json"),"Image bridge rejects non-image files");
        string huge = Path.Combine(root,"too-large.md"); using(var stream=File.Create(huge)) stream.SetLength(ReaderFiles.MaxDocumentBytes+1);
        Reject(()=>ReaderFiles.ReadDocument(huge),"Document size limit");
        string exe=Path.Combine(root,"Folder With Spaces","YueReader.exe");
        var plan=AppRegistration.Plan(exe);
        Check(plan.Any(e=>e.Key.EndsWith(@"shell\open\command") && e.Value=="\""+exe+"\" \"%1\""),"Quoted executable and document argument");
        Check(plan.Count(e=>e.Key.EndsWith(@"OpenWithProgids"))==4,"All four Markdown extensions advertised");
        Check(!plan.Any(e=>e.Key.IndexOf("UserChoice",StringComparison.OrdinalIgnoreCase)>=0),"No protected default-choice registry writes");
        Check(!plan.Any(e=>e.Key==@"Software\Classes\.md" && e.Name==""),"No forced extension default");
        Check(plan.Any(e=>e.Key==@"Software\RegisteredApplications" && e.Name=="YueReader"),"Default Apps registration present");
        File.WriteAllText(Path.Combine(root,"association-plan.json"),"[\n"+String.Join(",\n",plan.Select(e=>"{\"key\":\""+e.Key.Replace("\\","\\\\")+"\",\"name\":\""+e.Name+"\"}"))+"\n]");
        Console.WriteLine("Passed: "+passed+"; no registry writes performed.");
    }
}
