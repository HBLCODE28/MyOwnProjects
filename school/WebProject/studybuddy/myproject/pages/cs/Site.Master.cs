using System;
using System.Web;
using System.Web.UI;

public partial class StudyBuddy : MasterPage
{
    protected void Page_Load(object sender, EventArgs e)
    {
        //// Set the welcome message if the user is logged in
        //if (Session["UserName"] != null)
        //{
        //    WelcomeLiteral.Text = "Welcome, " + Session["UserName"].ToString() + "!";
        //}
        //else
        //{
        //    WelcomeLiteral.Text = string.Empty;
        //}
    }
}