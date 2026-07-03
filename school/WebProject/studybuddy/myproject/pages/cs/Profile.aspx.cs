using System;
using System.Data.SqlClient;

namespace UserPageNameSpace
{
    public partial class UserPage : System.Web.UI.Page
    {
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                lblUserName.InnerText = Session["UserName"] != null ? Session["UserName"].ToString() : " ";
                lblFirstName.InnerText = Session["FirstName"] != null ? Session["FirstName"].ToString() : "";
                lblLastName.InnerText = Session["LastName"] != null ? Session["LastName"].ToString() : "";
                lblEmail.InnerText = Session["Email"] != null ? Session["Email"].ToString() : "";

                if (Session["Admin"] != null && Convert.ToInt32(Session["Admin"]).ToString() == "1")
                {
                    admin.Visible = true;
                }

                string email = Session["Email"]?.ToString();
                lblTipCount.InnerText = GetTipCount(email);
                lblLikeCount.InnerText = GetLikeCount(email);
            }
        }

        private string GetTipCount(string userEmail)
        {
            if (string.IsNullOrEmpty(userEmail)) return "0";
            string query = "SELECT COUNT(*) FROM tips WHERE UserEmail = @UserEmail";

            using (SqlConnection con = new SqlConnection(connectionString))
            using (SqlCommand cmd = new SqlCommand(query, con))
            {
                cmd.Parameters.AddWithValue("@UserEmail", userEmail);
                try
                {
                    con.Open();
                    int count = (int)cmd.ExecuteScalar();
                    return count.ToString();
                }
                catch
                {
                    return "Error";
                }
            }
        }

        private string GetLikeCount(string userEmail)
        {
            if (string.IsNullOrEmpty(userEmail)) return "0";
            string query = @"
                SELECT COUNT(*) FROM TipLikes
                WHERE TipId IN (SELECT TipId FROM tips WHERE UserEmail = @UserEmail)";

            using (SqlConnection con = new SqlConnection(connectionString))
            using (SqlCommand cmd = new SqlCommand(query, con))
            {
                cmd.Parameters.AddWithValue("@UserEmail", userEmail);
                try
                {
                    con.Open();
                    int count = (int)cmd.ExecuteScalar();
                    return count.ToString();
                }
                catch
                {
                    return "Error";
                }
            }
        }
    }
}
