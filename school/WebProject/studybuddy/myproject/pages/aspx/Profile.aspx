<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/Profile.aspx.cs" Inherits="UserPageNameSpace.UserPage" MasterPageFile="../Master/Site.Master" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>User Profile</title>
    <link rel="stylesheet" type="text/css" href="/css/Site.css" />
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background-color: #f2f6fa;
        }

        #profile-card {
            max-width: 500px;
            margin: 50px auto;
            padding: 30px;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        #profile-card h2 {
            text-align: center;
            color: #333;
            margin-bottom: 25px;
        }

        .detail-row {
            margin: 12px 0;
            font-size: 15px;
            color: #444;
        }

        .detail-row strong {
            display: inline-block;
            width: 150px;
            color: #222;
        }

        .button-container {
            margin-top: 30px;
            display: flex;
            justify-content: space-around;
            gap: 10px;
        }

        .button {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            text-align: center;
            color: white;
            text-decoration: none;
            transition: background-color 0.3s ease;
        }

        .blue {
            background-color: #00aaff;
        }

        .blue:hover {
            background-color: #008ecc;
        }

        .darkblue {
            background-color: #005bbb;
        }

        .darkblue:hover {
            background-color: #004a99;
        }
    </style>
</head>
<body>
    <div id="profile-card">
        <h2>User Details</h2>

        <div class="detail-row"><strong>Username:</strong> <span runat="server" id="lblUserName"></span></div>
        <div class="detail-row"><strong>First Name:</strong> <span runat="server" id="lblFirstName"></span></div>
        <div class="detail-row"><strong>Last Name:</strong> <span runat="server" id="lblLastName"></span></div>
        <div class="detail-row"><strong>Email:</strong> <span runat="server" id="lblEmail"></span></div>
        <div class="detail-row"><strong>Number of Tips:</strong> <span runat="server" id="lblTipCount"></span></div>
        <div class="detail-row"><strong>Total Likes:</strong> <span runat="server" id="lblLikeCount"></span></div>

        <div class="button-container">
            <a href="UserTips.aspx" class="button blue">Your Tips!</a>
            <div id="admin" runat="server" visible="false">
                <a href="AdminPage.aspx" class="button darkblue">Admin Page</a>
            </div>
<a href="UserLikedTips.aspx" class="button blue" style="display: inline-block; padding: 10px 20px; text-align: center;">Liked Tips</a>
        </div>
    </div>
</body>
</html>
</asp:Content>
