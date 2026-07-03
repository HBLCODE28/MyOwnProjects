using System;
using System.IO;
using System.Web.UI;

public partial class Upload : Page
{
    protected void UploadButton_Click(object sender, EventArgs e)
    {
        if (FileUpload1.HasFile)
        {
            try
            {
                string folderPath = Server.MapPath("~/Uploads/");
                if (!Directory.Exists(folderPath))
                {
                    Directory.CreateDirectory(folderPath);
                }

                string filePath = Path.Combine(folderPath, Path.GetFileName(FileUpload1.FileName));
                FileUpload1.SaveAs(filePath);
                ResultLabel.Text = "File uploaded successfully!";
            }
            catch (Exception ex)
            {
                ResultLabel.Text = "File upload failed: " + ex.Message;
            }
        }
        else
        {
            ResultLabel.Text = "Please select a file to upload.";
        }
    }
}
