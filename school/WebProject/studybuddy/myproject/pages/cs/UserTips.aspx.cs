using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using System.Web;
using System.IO;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.Services;

namespace UserTipsNameSpace
{
    public partial class UserTips : System.Web.UI.Page
    {
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                // הצגת פרטי המשתמש מהסשן
                string userName = Session["UserName"] != null ? Session["UserName"].ToString() : " ";
                string firstName = Session["FirstName"] != null ? Session["FirstName"].ToString() : "";
                string lastName = Session["LastName"] != null ? Session["LastName"].ToString() : "";
                string email = Session["Email"] != null ? Session["Email"].ToString() : "";
                string script = $"document.getElementById('user-tips').innerText = '{userName} tips';";
                ClientScript.RegisterStartupScript(this.GetType(), "setText", script, true);

                // הצגת טיפים
                UserTipsLiteral.Text = showUserTips(email);
            }
        }

        // פונקציה להפעלת שאילתות מול מסד נתונים
        public static (bool success, object result) RunQuery(string query, string[][] parms)
        {
            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand(query, con))
                {
                    if (parms != null)
                    {
                        foreach (var param in parms)
                        {
                            if (param.Length == 2)
                            {
                                cmd.Parameters.AddWithValue("@" + param[0], param[1]);
                            }
                        }
                    }

                    try
                    {
                        con.Open();
                        if (query.Trim().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
                        {
                            using (SqlDataReader reader = cmd.ExecuteReader())
                            {
                                var results = new List<Dictionary<string, object>>();
                                while (reader.Read())
                                {
                                    var row = new Dictionary<string, object>();
                                    for (int i = 0; i < reader.FieldCount; i++)
                                    {
                                        row[reader.GetName(i)] = reader.GetValue(i);
                                    }
                                    results.Add(row);
                                }
                                return (true, results);
                            }
                        }
                        else
                        {
                            int rowsAffected = cmd.ExecuteNonQuery();
                            return (rowsAffected > 0, null);
                        }
                    }
                    catch (Exception ex)
                    {
                        HttpContext.Current.Response.Write($"General Error: {ex.Message}\n");
                        return (false, null);
                    }
                }
            }
        }

        // הצגת הטיפים של המשתמש
        public string showUserTips(string UserEmail)
        {
            string query = "SELECT TipName, TipText, UserEmail, TipDate, TipSubject, TipRelatedFiles, TipId FROM Tips WHERE UserEmail = @UserEmail ORDER BY TipDate DESC;";
            string[][] parameters = new string[][] {
        new string[] { "UserEmail", UserEmail }
    };

            var queryResult = RunQuery(query, parameters);
            var tips = queryResult.result as List<Dictionary<string, object>>;
            List<string> tipsHtml = new List<string>();

            try
            {
                if (tips != null && tips.Any())
                {
                    // Email של המשתמש המחובר (לא של היוצר)
                    string currentUserEmail = HttpContext.Current.Session["Email"]?.ToString();
                    HashSet<int> likedTips = new HashSet<int>();

                    if (!string.IsNullOrEmpty(currentUserEmail))
                    {
                        using (SqlConnection conn = new SqlConnection(connectionString))
                        {
                            conn.Open();
                            using (SqlCommand cmd = new SqlCommand("SELECT TipId FROM TipLikes WHERE UserEmail = @Email", conn))
                            {
                                cmd.Parameters.AddWithValue("@Email", currentUserEmail);
                                using (SqlDataReader reader = cmd.ExecuteReader())
                                {
                                    while (reader.Read())
                                    {
                                        likedTips.Add(Convert.ToInt32(reader["TipId"]));
                                    }
                                }
                            }
                        }
                    }

                    foreach (var tip in tips)
                    {
                        string tipName = tip["TipName"].ToString();
                        string tipText = tip["TipText"].ToString();
                        string userEmail = tip["UserEmail"].ToString();
                        DateTime tipDate = Convert.ToDateTime(tip["TipDate"]);
                        string tipSubject = tip["TipSubject"].ToString();
                        int tipId = Convert.ToInt32(tip["TipId"]);

                        // שליפת כמות לייקים בפועל
                        int likeCount = 0;
                        using (SqlConnection countConn = new SqlConnection(connectionString))
                        {
                            countConn.Open();
                            using (SqlCommand countCmd = new SqlCommand("SELECT COUNT(*) FROM TipLikes WHERE TipId = @TipId", countConn))
                            {
                                countCmd.Parameters.AddWithValue("@TipId", tipId);
                                likeCount = (int)countCmd.ExecuteScalar();
                            }
                        }

                        string isLiked = likedTips.Contains(tipId) ? "true" : "false";

                        string filePath = string.IsNullOrEmpty(tip["TipRelatedFiles"].ToString())
                            ? null
                            : ResolveUrl("../../Uploads/" + Path.GetFileName(tip["TipRelatedFiles"].ToString()));

                        string tipHtml = $@"
                <div class='row'>
                    <div class='col-md-12'>
                        <div class='card mb-4 shadow-sm'>
                            <div class='card-body'>
                                <h5 class='card-title font-weight-bold'>{tipName}</h5>";

                        if (!string.IsNullOrEmpty(filePath))
                        {
                            string fileExtension = Path.GetExtension(filePath).ToLower();
                            if (fileExtension == ".pdf")
                            {
                                tipHtml += $"<a href='{filePath}' target='_blank'>Download pdf</a>";
                            }
                            else
                            {
                                tipHtml += $"<img src='{filePath}' class='card-img-top mt-3' alt='Related image' style='width: 100%; height: auto; object-fit: cover;' />";
                            }
                        }

                        tipHtml += $@"
                                <h6 class='card-subtitle mb-2 text-muted'>
                                    By {userEmail} - {tipDate:dd/MM/yyyy HH:mm}
                                    <button type='button' id='like-btn-{tipId}' data-likes='{likeCount}' data-liked='{isLiked}'
                                        class='like-btn' style='border: none; background: none; cursor: pointer; margin-left: 10px;'
                                        onclick='toggleLike({tipId})'>❤️ {likeCount}</button>
                                </h6>
                                <p class='card-text' style='color: black;'><strong>Subject:</strong> {tipSubject}</p>
                                <p class='card-text' style='color: black;'>{tipText}</p>
                            </div>
                        </div>
                    </div>
                </div>";

                        tipsHtml.Add(tipHtml);
                    }
                }
                else
                {
                    tipsHtml.Add("<p>You haven't posted any tips yet.</p>");
                }
            }
            catch (Exception ex)
            {
                tipsHtml.Add($"<p>An error occurred: {ex.Message}</p>");
            }

            return string.Join("", tipsHtml);
        }

        [WebMethod(EnableSession = true)]
        public static int LikeTip(int tipId)
        {
            string userEmail = HttpContext.Current.Session["Email"]?.ToString();
            if (string.IsNullOrEmpty(userEmail)) return -1;

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // נסה להוסיף לייק רק אם לא קיים
                using (SqlCommand insertCmd = new SqlCommand(@"
            IF NOT EXISTS (
                SELECT 1 FROM TipLikes WHERE UserEmail = @UserEmail AND TipId = @TipId
            )
            BEGIN
                INSERT INTO TipLikes (UserEmail, TipId) VALUES (@UserEmail, @TipId)
            END
        ", conn))
                {
                    insertCmd.Parameters.AddWithValue("@UserEmail", userEmail);
                    insertCmd.Parameters.AddWithValue("@TipId", tipId);
                    int result = insertCmd.ExecuteNonQuery();
                    if (result == 0) return -1; // כבר עשה לייק
                }

                // החזר את כמות הלייקים הנוכחית
                using (SqlCommand countCmd = new SqlCommand("SELECT COUNT(*) FROM TipLikes WHERE TipId = @TipId", conn))
                {
                    countCmd.Parameters.AddWithValue("@TipId", tipId);
                    return (int)countCmd.ExecuteScalar();
                }
            }
        }



        [WebMethod(EnableSession = true)]
        public static int UnlikeTip(int tipId)
        {
            string userEmail = HttpContext.Current.Session["Email"]?.ToString();
            if (string.IsNullOrEmpty(userEmail)) return -1;

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // מחיקת הלייק
                using (SqlCommand deleteCmd = new SqlCommand("DELETE FROM TipLikes WHERE UserEmail = @UserEmail AND TipId = @TipId", conn))
                {
                    deleteCmd.Parameters.AddWithValue("@UserEmail", userEmail);
                    deleteCmd.Parameters.AddWithValue("@TipId", tipId);
                    int result = deleteCmd.ExecuteNonQuery();
                    if (result == 0) return -1; // לא היה לייק
                }

                // החזר את כמות הלייקים המעודכנת
                using (SqlCommand countCmd = new SqlCommand("SELECT COUNT(*) FROM TipLikes WHERE TipId = @TipId", conn))
                {
                    countCmd.Parameters.AddWithValue("@TipId", tipId);
                    return (int)countCmd.ExecuteScalar();
                }
            }
        }


    }
}

