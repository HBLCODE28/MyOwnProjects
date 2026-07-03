using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using System.Web;
using System.IO;


namespace AboutUsNameSpace
{
    public partial class AboutUs : System.Web.UI.Page
    {
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                CountTips();
                CountLikes();
                CountUsers();
            }
        }


       public  void CountTips()
        {
            int totalTips =0;
            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();
                using (SqlCommand cmd = new SqlCommand("SELECT COUNT(*) AS TotalTips FROM tips;", conn))
                {
                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            totalTips= Convert.ToInt32(reader["TotalTips"]);
                            tipsCount.InnerHtml = totalTips.ToString();
                        }
                    }
                }
            }
        }
        public void CountLikes()
        {
            int totalLikes = 0;
            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();
                using (SqlCommand cmd = new SqlCommand("SELECT COUNT(*) AS TotalLikes  FROM TipLikes;", conn))
                {
                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            totalLikes = Convert.ToInt32(reader["TotalLikes"]);
                            likesCount.InnerHtml = totalLikes.ToString();
                        }
                    }
                }
            }
        }
        public void CountUsers()
        {
            int totalUsers = 0;
            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();
                using (SqlCommand cmd = new SqlCommand("SELECT COUNT(*) AS TotalUsers FROM users;", conn))
                {
                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            totalUsers = Convert.ToInt32(reader["TotalUsers"]);
                            usersCount.InnerHtml =totalUsers.ToString();
                        }
                    }
                }
            }
        }









    }
}
