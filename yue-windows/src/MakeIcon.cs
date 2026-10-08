using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;
class MakeIcon {
    static void Main(string[] args) {
        int[] sizes = {16,24,32,48,64,128,256};
        var frames = new List<byte[]>();
        foreach (int size in sizes) using (var bitmap = new Bitmap(size,size)) {
            using (var g = Graphics.FromImage(bitmap)) {
                g.SmoothingMode = SmoothingMode.AntiAlias; g.ScaleTransform(size/256f,size/256f); g.Clear(Color.Transparent);
                using (var path = new GraphicsPath()) using (var fill = new SolidBrush(Color.FromArgb(125,109,84))) {
                    path.AddArc(8,8,72,72,180,90); path.AddArc(176,8,72,72,270,90); path.AddArc(176,176,72,72,0,90); path.AddArc(8,176,72,72,90,90); path.CloseFigure(); g.FillPath(fill,path);
                }
                using (var pen = new Pen(Color.FromArgb(255,252,246),10)) {
                    pen.LineJoin = LineJoin.Round; pen.StartCap = pen.EndCap = LineCap.Round;
                    g.DrawPolygon(pen,new PointF[]{new PointF(61,69),new PointF(128,92),new PointF(195,69),new PointF(195,183),new PointF(128,161),new PointF(61,183)});
                    g.DrawLine(pen,128,92,128,161);
                }
            }
            using (var ms = new MemoryStream()) { bitmap.Save(ms,ImageFormat.Png); frames.Add(ms.ToArray()); }
        }
        using (var writer = new BinaryWriter(File.Create(args[0]))) {
            writer.Write((ushort)0); writer.Write((ushort)1); writer.Write((ushort)sizes.Length); int offset = 6+16*sizes.Length;
            for(int i=0;i<sizes.Length;i++) { writer.Write((byte)(sizes[i]==256?0:sizes[i]));writer.Write((byte)(sizes[i]==256?0:sizes[i]));writer.Write((byte)0);writer.Write((byte)0);writer.Write((ushort)1);writer.Write((ushort)32);writer.Write(frames[i].Length);writer.Write(offset);offset+=frames[i].Length; }
            foreach(byte[] frame in frames) writer.Write(frame);
        }
    }
}
