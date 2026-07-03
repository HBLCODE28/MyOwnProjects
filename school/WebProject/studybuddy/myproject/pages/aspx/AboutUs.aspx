<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/AboutUs.aspx.cs" Inherits="AboutUsNameSpace.AboutUs" MasterPageFile="../Master/Site.Master" %>

<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <!DOCTYPE html>
    <head>
        <meta charset="utf-8" />
        <title>About Us</title>
        <link rel="stylesheet" type="text/css" href="/css/Site.css" />
        <style>
            .stats-container {
                display: flex;
                justify-content: space-between;
                margin-top: 40px;
            }
            .stat-box {
                flex: 1;
                margin: 0 10px;
                background: #f9f9f9;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .stat-title {
                font-weight: bold;
                font-size: 18px;
                margin-bottom: 10px;
            }
            .stat-icon {
                font-size: 40px;
                margin-bottom: 10px;
            }
            .stat-number {
                font-size: 24px;
                font-weight: bold;
            }
        </style>
        <script src="https://kit.fontawesome.com/a076d05399.js" crossorigin="anonymous"></script>
    </head>
    <body>
        <div id="container">
            <div id="aboutUs" class="slippery-snail" style="max-width: 900px; margin: 50px auto; padding: 30px;">
                <h2><strong>About StudyBuddy</strong></h2>

                <p>StudyBuddy was created out of a real need: a simple, secure, and welcoming place where students from all over can share practical learning tips, help each other understand better, and build a supportive learning community.</p>

                <p>The site was developed as part of a final project in a high school computer science track, inspired by a personal experience of searching for useful study resources and realizing something was missing — a centralized, tip-based, student-driven platform.</p>

                <p>On StudyBuddy, registered users can publish learning tips, attach files and images, browse tips by subject or date, and engage with content that matters to them. Whether you're a student, a teacher, or just someone eager to learn better — this space is for you.</p>

                <p>We believe that learning is most effective when it's shared. Our mission is to encourage collaboration, promote accessible and practical knowledge, and make studying a more empowering experience.</p>

                <p><strong>Join us, and be part of a community that grows by helping each other learn.</strong></p>

                <div class="stats-container">
                    <div class="stat-box">
                        <div class="stat-title">Total Likes</div>
                        <div class="stat-icon"><i class="fas fa-thumbs-up"></i></div>
                        <div class="stat-number" id="likesCount" runat="server"></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Total Tips</div>
                        <div class="stat-icon"><i class="fas fa-lightbulb"></i></div>
                        <div class="stat-number" id="tipsCount" runat="server"></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Total Users</div>
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                        <div class="stat-number" id="usersCount" runat="server"></div>
                    </div>
                </div>
            </div>
        </div>
    </body>
</asp:Content>

