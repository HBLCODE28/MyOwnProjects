using System;

namespace LogOutNameSpace
{
    public partial class Logout : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            // Page.Title = "Log Out";
            // שחרור משתני הסשן
            Session["UserName"] = null;
            Session["FirstName"] = null;
            Session["LastName"] = null;
            Session["Email"] = null;

            // סיום הסשן
            Session.Abandon();

            Response.Redirect("../aspx/LogIn.aspx");
        }

    }
}
