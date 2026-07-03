<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/Leaderboard.aspx.cs" Inherits="LeaderboardNameSpace.Leaderboard" MasterPageFile="../Master/Site.Master" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">

<div class="container mt-4">
    <div class="row justify-content-center">

        <!-- Card: Most Tips -->
        <div class="col-md-6 mb-4">
            <div class="card text-center shadow">
                <div class="card-header">
                    <h4>Leaderboard: Most Tips</h4>
                </div>
                <div class="card-body">
                    <asp:Literal ID="TipsList" runat="server" />
                </div>
            </div>
        </div>

        <!-- Card: Most Likes -->
        <div class="col-md-6 mb-4">
            <div class="card text-center shadow">
                <div class="card-header">
                    <h4>Leaderboard: Most Likes</h4>
                </div>
                <div class="card-body">
                    <asp:Literal ID="LikesList" runat="server" />
                </div>
            </div>
        </div>

    </div>
</div>

</asp:Content>
