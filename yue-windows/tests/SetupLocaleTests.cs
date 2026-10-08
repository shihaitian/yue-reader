using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using YueReader;

class SetupLocaleTests {
    sealed class TestWindow : SetupWindow {
        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams { get { var p=base.CreateParams; p.ExStyle |= 0x08000000; return p; } }
    }
    [STAThread] static void Main(string[] args) {
        string root=Path.GetFullPath(args[0]); Directory.CreateDirectory(root);
        Environment.SetEnvironmentVariable("YUE_READER_DATA",Path.Combine(root,"profile"));
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        using(var form=new TestWindow()) {
          form.Opacity=0; form.ShowInTaskbar=false;
          form.Shown += (sender,args2) => form.BeginInvoke(new Action(() => {
           try {
                var selector=(ComboBox)form.Controls.Find("Language",true)[0];
                for(int i=0;i<L.Languages.Length;i++) {
                    selector.SelectedIndex=i; form.PerformLayout(); Application.DoEvents();
                    foreach(string name in new[]{"Install","Title","Associate","Desktop","Location","Language"}) {
                        Control control=form.Controls.Find(name,true)[0];
                        if(control.Right>control.Parent.ClientSize.Width+1 || control.Bottom>control.Parent.ClientSize.Height+1)throw new Exception("Clipped control: "+L.Languages[i]+" "+name);
                    }
                    if(form.Text!=L.T("安装"))throw new Exception("Setup title is untranslated.");
                    if(L.Language!="zh-CN" && L.T("安装包含有无效路径。").Contains("无效"))throw new Exception("Setup errors are untranslated.");
                    using(var bitmap=new Bitmap(form.Width,form.Height)) { form.DrawToBitmap(bitmap,new Rectangle(Point.Empty,bitmap.Size)); bitmap.Save(Path.Combine(root,"setup-"+L.Language+".png")); }
                }
            File.WriteAllText(Path.Combine(root,"result.txt"),"PASS: seven setup languages, title and error translations, layout bounds; no installation or registry changes.");
           }catch(Exception error){File.WriteAllText(Path.Combine(root,"result.txt"),"FAIL: "+error);Environment.ExitCode=1;}
           finally{form.Close();}
          }));
          Application.Run(form);
        }
    }
}
