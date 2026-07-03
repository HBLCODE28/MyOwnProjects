<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/HomePage.aspx.cs" Inherits="Namespace.HomePage" MasterPageFile="../Master/Site.Master" %>

<asp:Content runat="server" ID="Content1" ContentPlaceHolderID="MainContent">

    <div class="container mt-5">
        <!-- Welcome Section -->
        <div class="row mt-5 justify-content-center">
            <div class="col-lg-12 text-center">
                <h1 class="display-4 font-weight-bold">Welcome to StudyBuddy!</h1>
                <p class="lead" >Welcome to StudyBuddy – a collaborative platform where students share learning tips, files, and study insights to make learning easier and more effective.</p>
            </div>
        </div>
         <div style="text-align:center" >
             <img src="/images/logo.png"  class="img-fluid" alt="StudyBuddyIcon" />
         </div>
        
        <div class="row mt-3 justify-content-center">
    <div class="col-lg-12 text-center d-flex justify-content-center flex-wrap">
        <a href="/pages/aspx/Tips.aspx" class="button mx-2">
            Discover Tips!
        </a>

        <% if (Session["UserName"] != null) { %>                    
            <a href="/pages/aspx/NewTip.aspx" class="button mx-2">
                Create New Tip!
            </a>
        <% } %>

        <a href="/pages/aspx/Leaderboard.aspx" class="button mx-2">
            Leaderboard!
        </a>
    </div>
</div>

        </div>

        <br /><br />
        <!-- Footer Section -->
        <footer class="footer">
            <div class="container p-4">
                <div class="text-center" >
                    <p>&copy; <%: DateTime.Now.Year %> - StudyBuddy </p>
                </div>
            </div>
        </footer>
    </div>
</asp:Content>
