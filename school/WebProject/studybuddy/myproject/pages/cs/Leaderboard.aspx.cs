using System;
using System.Data.SqlClient;
using System.Text;
using System.Web.UI;

namespace LeaderboardNameSpace
{
    public partial class Leaderboard : Page
    {
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                LoadTipLeaders();
                LoadLikeLeaders();
            }
        }

        private void LoadTipLeaders()
        {
            string query = @"SELECT TOP 5 u.userName, COUNT(t.TipId) AS TipCount
                             FROM users u
                             JOIN tips t ON u.email = t.UserEmail
                             GROUP BY u.userName
                             ORDER BY TipCount DESC";

            StringBuilder html = new StringBuilder();
            html.Append("<ol>");

            using (SqlConnection con = new SqlConnection(connectionString))
            using (SqlCommand cmd = new SqlCommand(query, con))
            {
                con.Open();
                SqlDataReader reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    string name = reader["userName"].ToString();
                    string count = reader["TipCount"].ToString();
                    html.Append($"<li>{name} - {count} Tips</li>");
                }
            }

            html.Append("</ol>");
            TipsList.Text = html.ToString();
        }

        private void LoadLikeLeaders()
        {
            string query = @"SELECT TOP 5 u.userName, COUNT(l.Id) AS LikeCount
                             FROM users u
                             JOIN tips t ON u.email = t.UserEmail
                             JOIN TipLikes l ON t.TipId = l.TipId
                             GROUP BY u.userName
                             ORDER BY LikeCount DESC";

            StringBuilder html = new StringBuilder();
            html.Append("<ol>");

            using (SqlConnection con = new SqlConnection(connectionString))
            using (SqlCommand cmd = new SqlCommand(query, con))
            {
                con.Open();
                SqlDataReader reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    string name = reader["userName"].ToString();
                    string count = reader["LikeCount"].ToString();
                    html.Append($"<li>{name} - {count} Likes</li>");
                }
            }

            html.Append("</ol>");
            LikesList.Text = html.ToString();
        }
    }
}
