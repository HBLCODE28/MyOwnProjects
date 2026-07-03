<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/UserLikedTips.aspx.cs" Inherits="UserLikedTipsNameSpace.UserLikedTips" MasterPageFile="../Master/Site.Master" %>

<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <link rel="stylesheet" type="text/css" href="/css/Site.css" />

    <div class="container mt-5">
        <h1 class="text-center" id="user-tips"></h1>
        <div class="row">
            <div class="col-md-12">
                <%--<h3>User Tips</h3>--%>
                <asp:Literal ID="UserLikedTipsLiteral" runat="server" />
            </div>
        </div>
    </div>

    <style>
        #user-tips p {
            font-size: 13px;
            line-height: 1.5;
        }

        #user-tips::-webkit-scrollbar {
            width: 8px;
        }

        #user-tips::-webkit-scrollbar-thumb {
            background-color: #c5e2e2;
            border-radius: 5px;
        }

        #user-tips::-webkit-scrollbar-thumb:hover {
            background-color: #c5e2e2;
        }
    </style>
    <script>
        function toggleLike(tipId) {
            const isLoggedIn = '<%= Session["UserName"] != null ? "true" : "false" %>';

              if (isLoggedIn !== "true") {
                  alert("Please log in to like tips ❤️");
                  return;
              }

              const btn = document.querySelector(`#like-btn-${tipId}`);
              let current = parseInt(btn.dataset.likes) || 0;
              const liked = btn.dataset.liked === "true";

              const url = liked ? 'Tips.aspx/UnlikeTip' : 'Tips.aspx/LikeTip';

              fetch(url, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ tipId: tipId })
              })
                  .then(res => res.json())
                  .then(data => {
                      const newLikes = data.d;
                      btn.dataset.likes = newLikes;
                      btn.dataset.liked = liked ? "false" : "true";
                      btn.innerHTML = `${liked ? "🤍" : "❤️"} ${newLikes}`;
                  })
                  .catch(err => console.error('Error updating like:', err));
          }
    </script>

<%--    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js"></script>--%>
</asp:Content>
