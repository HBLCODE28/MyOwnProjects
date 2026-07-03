using System;
using System.Data.SqlClient;
using System.Text.RegularExpressions;
using System.Web.UI;
using System.IO;
using System.Collections.Generic;

namespace Namespace
{
    public partial class NewTip : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
               // Page.Title = "Create a new tip!";

                string userName = Session["UserName"] != null ? Session["UserName"].ToString() : " ";
                string firstName = Session["FirstName"] != null ? Session["FirstName"].ToString() : "";
                string lastName = Session["LastName"] != null ? Session["LastName"].ToString() : "";
                //string admin = Session["Admin"] != null ? Convert.ToInt32(Session["admin"]).ToString() : "0";
            }
        }

        protected void btnSubmit_Click(object sender, EventArgs e)
        {
            string tipName = txtTipName.Text.Trim();
            string tipSubject = ddlSubjects.SelectedItem.Text.Trim(); // changed from TextBox to DropDownList
            string tipText = txtTipText.Text.Trim();

            // קבלת שם המשתמש מה-session
            string userEmail = GetCurrentUserEmail();

            // Perform validation
            if (ValidateForm(tipName, tipSubject, tipText)) // Ensure the validation includes tipText
            {
                string filePath = null;

                // Check if there is a file to upload
                if (FileUpload1.HasFile)
                {
                    filePath = UploadFile();
                    if (filePath == null)
                    {
                        // If the file upload fails (e.g., invalid file type), stop the process
                        ShowAlert("File upload failed. Please try again with a valid file.");
                        return;  // Prevent form submission
                    }
                    else
                    {
                        FileUpload1Error.Style["display"] = "none";
                    }
                }

                // Save data to the database
                SaveToDatabase(tipName, tipSubject, tipText, filePath, userEmail);

                // Show success alert
                ShowAlert("New Tip Was Added!");
            }
            else
            {
                // Show failure alert if form validation fails
                ShowAlert("Form validation failed.");
            }
        }


        private bool ValidateForm(string txtTipName, string txtTipSubject, string txtTipText)
        {
            bool isValid = true;
            //Response.Write($"<script>alert('txtTipName: {txtTipName} ');</script>");
            // Validate tip name
            string trimmedTipName = txtTipName.Trim();
            //Response.Write($"<script>alert('trimmedTipName: {trimmedTipName} ');</script>");
            if (string.IsNullOrEmpty(trimmedTipName) || IsValidtxtTipName(trimmedTipName))
            {
                isValid = false;
                // Show error message for name
                TipNameError.Style["display"] = "block";
            }
            else
            {
                TipNameError.Style["display"] = "none";
            }
            //Response.Write($"<script>alert('isValid: {isValid} ');</script>");


            // Validate subject
            if (string.IsNullOrEmpty(txtTipSubject.TrimEnd()) || !IsValidtxtTipSubject(txtTipSubject.TrimEnd()))
            {
                isValid = false;
                // Show error message for subject
                SubjectError.Style["display"] = "block";
            }
            else
            {
                SubjectError.Style["display"] = "none";
            }

            // Validate tip text
            if (string.IsNullOrEmpty(txtTipText.TrimEnd()) || !IsValidtxtTipText(txtTipText.TrimEnd()))
            {
                isValid = false;
                // Show error message for tip text
                TipTextError.Style["display"] = "block";
            }
            else
            {
                TipTextError.Style["display"] = "none";
            }

            // Check for forbidden words in the tip text
            if (ContainsForbiddenWords(txtTipText) || ContainsForbiddenWords(trimmedTipName))
            {
                isValid = false;
                // Show error message for forbidden words
                //TipTextError.Style["display"] = "block";
                //Console.WriteLine("Forbidden words found!");
            }

            return isValid;
        }



        private bool IsValidtxtTipText(string txtTipText)
        {
            return txtTipText.Length <= 50; // or any other validation you want
        }

        private bool IsValidtxtTipName(string txtTipName)
        {
            bool result = Regex.IsMatch(txtTipName, @"^[A-Za-z0-9\s!#$%&'()*+,-./:;<=>?@[\\]^_`{|}~]{2,}$");
            return result;
        }

        private bool IsValidtxtTipSubject(string txtTipSubject)
        {
            return Regex.IsMatch(txtTipSubject, @"^[A-Za-z\s]{2,50}$");
        }

        private bool ContainsForbiddenWords(string tipText)
        {
            string[] forbiddenWords = new string[] {
                "2g1c", "2 girls 1 cup", "acrotomophilia", "alabama hot pocket", "alaskan pipeline", "anal", "anilingus",
                "anus", "apeshit", "arsehole", "ass", "asshole", "assmunch", "auto erotic", "autoerotic", "babeland", "baby batter",
                "baby juice", "ball gag", "ball gravy", "ball kicking", "ball licking", "ball sack", "ball sucking", "bangbros",
                "bareback", "barely legal", "barenaked", "bastard", "bastardo", "bastinado", "bbw", "bdsm", "beaner", "beaners",
                "beaver cleaver", "beaver lips", "bestiality", "big black", "big breasts", "big knockers", "big tits", "bimbos",
                "birdlock", "bitch", "bitches", "black cock", "blonde action", "blonde on blonde action", "blowjob", "blow job",
                "blow your load", "blue waffle", "blumpkin", "bollocks", "bondage", "boner", "boob", "boobs", "booty call",
                "brown showers", "brunette action", "bukkake", "bulldyke", "bullet vibe", "bullshit", "bung hole", "bunghole",
                "busty", "butt", "buttcheeks", "butthole", "camel toe", "camgirl", "camslut", "camwhore", "carpet muncher",
                "carpetmuncher", "chocolate rosebuds", "circlejerk", "cleveland steamer", "clit", "clitoris", "clover clamps",
                "clusterfuck", "cock", "cocks", "coprolagnia", "coprophilia", "cornhole", "coon", "coons", "creampie", "cum",
                "cumming", "cunnilingus", "cunt", "darkie", "date rape", "daterape", "deep throat", "deepthroat", "dendrophilia",
                "dick", "dildo", "dingleberry", "dingleberries", "dirty pillows", "dirty sanchez", "doggie style", "doggiestyle",
                "doggy style", "doggystyle", "dog style", "dolcett", "domination", "dominatrix", "dommes", "donkey punch",
                "double dong", "double penetration", "dp action", "dry hump", "dvda", "eat my ass", "ecchi", "ejaculation", "erotic",
                "erotism", "escort", "eunuch", "faggot", "fecal", "felch", "fellatio", "feltch", "female squirting", "femdom", "figging",
                "fingerbang", "fingering", "fisting", "foot fetish", "footjob", "frotting", "fuck", "fuck buttons", "fuckin", "fucking",
                "fucktards", "fudge packer", "fudgepacker", "futanari", "gang bang", "gay sex", "genitals", "giant cock", "girl on",
                "girl on top", "girls gone wild", "goatcx", "goatse", "god damn", "gokkun", "golden shower", "goodpoop", "goo girl",
                "goregasm", "grope", "group sex", "g-spot", "guro", "hand job", "handjob", "hard core", "hardcore", "hentai", "homoerotic",
                "honkey", "hooker", "hot carl", "hot chick", "how to kill", "how to murder", "huge fat", "humping", "incest", "intercourse",
                "jack off", "jail bait", "jailbait", "jelly donut", "jerk off", "jigaboo", "jiggaboo", "jiggerboo", "jizz", "juggs",
                "kike", "kinbaku", "kinkster", "kinky", "knobbing", "leather restraint", "leather straight jacket", "lemon party", "lolita",
                "lovemaking", "make me come", "male squirting", "masturbate", "menage a trois", "milf", "missionary position", "motherfucker",
                "mound of venus", "mr hands", "muff diver", "muffdiving", "nambla", "nawashi", "negro", "neonazi", "nigga", "nigger",
                "nig nog", "nimphomania", "nipple", "nipples", "nsfw images", "nude", "nudity", "nympho", "nymphomania", "octopussy",
                "omorashi", "one cup two girls", "one guy one jar", "orgasm", "orgy", "paedophile", "paki", "panties", "panty", "pedobear",
                "pedophile", "pegging", "penis", "phone sex", "piece of shit", "pissing", "piss pig", "pisspig", "playboy", "pleasure chest",
                "pole smoker", "ponyplay", "poof", "poon", "poontang", "punany", "poop chute", "poopchute", "porn", "porno", "pornography",
                "prince albert piercing", "pthc", "pubes", "pussy", "queaf", "queef", "quim", "raghead", "raging boner", "rape", "raping",
                "rapist", "rectum", "reverse cowgirl", "rimjob", "rimming", "rosy palm", "rosy palm and her 5 sisters", "rusty trombone", "sadism",
                "santorum", "scat", "schlong", "scissoring", "semen", "sex", "sexo", "sexy", "shaved beaver", "shaved pussy", "shemale", "shibari",
                "shit", "shitblimp", "shitty", "shota", "shrimping", "skeet", "slanteye", "slut", "s&m", "smut", "snatch", "snowballing",
                "sodomize", "sodomy", "spic", "splooge", "splooge moose", "spooge", "spread legs", "spunk", "strap on", "strapon", "strappado",
                "strip club", "style doggy", "suck", "sucks", "suicide girls", "sultry women", "swastika", "swinger", "tainted love",
                "taste my", "tea bagging", "threesome", "throating", "tied up", "tight white", "tit", "tits", "titties", "titty", "tongue in a",
                "topless", "tosser", "towelhead", "tranny", "tribadism", "tub girl", "tubgirl", "tushy", "twat", "twink", "twinkie", "two girls one cup",
                "undressing", "upskirt", "urethra play", "urophilia", "vagina", "venus mound", "vibrator", "violet wand", "vorarephilia", "voyeur",
                "vulva", "wank", "wetback", "wet dream", "white power", "wrapping men", "wrinkled starfish", "xx", "xxx", "yaoi", "yellow showers", "yiffy",
                "zoophilia"
            };

            foreach (var word in forbiddenWords)
            {
                if (tipText.ToLower().Contains(word))
                {
                    ShowAlert($"Tip contains inappropriate content: {word}");
                    return true;
                }
            }

            return false;
        }

        protected string UploadFile()
        {
            // If there is no file to upload, no need to proceed
            if (!FileUpload1.HasFile)
            {
                return null;
            }

            try
            {
                // Get the ContentType of the uploaded file
                string contentType = FileUpload1.PostedFile.ContentType;

                // Check if the ContentType is allowed
                if (!IsAllowFiletype(contentType))
                {
                    
                    FileUpload1Error.Style["display"] = "block";
                    FileUpload1Error.Text = "File type not allowed. (allowed types : .pdf,.png,.jpg,.jpeg)";

                    return null;
                }

                // Create the path for the uploads folder
                string folderPath = Server.MapPath("~/Uploads/");
                if (!Directory.Exists(folderPath))
                {
                    Directory.CreateDirectory(folderPath);
                }

                string originalFileName = Path.GetFileName(FileUpload1.FileName);

                // Create a unique file name (do not use the original file name)
                string uniqueFileName = Guid.NewGuid().ToString() + Path.GetExtension(originalFileName);
                string filePath = Path.Combine(folderPath, uniqueFileName);

                // Save the file
                FileUpload1.SaveAs(filePath);



                // Success message for the user
                //ResultLabel.Text = "File uploaded successfully!";
                return uniqueFileName;
            }
            catch (Exception ex)
            {
                FileUpload1Error.Style["display"] = "block";
                FileUpload1Error.Text = "File upload failed. Please try again later.";
                return null;
            }
        }

        private bool IsAllowFiletype(string contentType)
        {
            var allowedContentTypes = new List<string>
    {
        "application/pdf",  // .pdf
        "image/png",  // .png
        "image/jpeg",  // .jpg, .jpeg
    };

            return allowedContentTypes.Contains(contentType);
        }





        private void ShowAlert(string message)
        {
            ClientScript.RegisterStartupScript(this.GetType(), "alert", $"alert('{message}');", true);
        }

        private string GetCurrentUserEmail()
        {
            if (Session["Email"] != null)
            {
                return Session["Email"].ToString();
            }

            return "Guest";
        }

        private void SaveToDatabase(string tipName, string tipSubject, string tipText, string filePath, string userEmail)
        {
            DateTime currentDateTime = DateTime.Now;
            string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

            using (SqlConnection connection = new SqlConnection(connectionString))
            {
                connection.Open();

                string query = @"
            INSERT INTO Tips 
                (TipName, TipDate, TipText, TipSubject, TipRelatedFiles, UserEmail) 
            VALUES 
                (@TipName, @TipDate, @TipText, @TipSubject, @TipRelatedFiles, @UserEmail)";

                using (SqlCommand command = new SqlCommand(query, connection))
                {
                    command.Parameters.AddWithValue("@TipName", tipName);
                    command.Parameters.AddWithValue("@TipDate", currentDateTime);
                    command.Parameters.AddWithValue("@TipText", tipText);
                    command.Parameters.AddWithValue("@TipSubject", tipSubject);
                    command.Parameters.AddWithValue("@UserEmail", userEmail);

                    if (string.IsNullOrEmpty(filePath))
                        command.Parameters.AddWithValue("@TipRelatedFiles", DBNull.Value);
                    else if (filePath.Length > 255)
                        throw new Exception("File path is too long.");
                    else
                        command.Parameters.AddWithValue("@TipRelatedFiles", filePath);

                    command.ExecuteNonQuery();
                }
            }
        }

    }
}
