<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/Tips.aspx.cs" MasterPageFile="../Master/Site.Master" Inherits="Namespace.Tips" %>

<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <link href="https://fonts.googleapis.com/css2?family=Monomaniac+One&display=swap" rel="stylesheet">
    <link rel="stylesheet" type="text/css" href="../css/Site.css">

    <div class="album py-5">
    <div class="container">
        <h2 class="text-center mb-5">Tips</h2>

        <!-- Filter controls -->
        <div class="mb-3">
            <label for="subjectFilter">Sort Tips by Subject:</label>
            <select id="subjectFilter" class="dropdown-menu4 form-control">
                <option value="all">All Subjects</option>
                <option value="Biology">Biology</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Physics">Physics</option>
                <option value="Geography">Geography</option>
                <option value="Environmental Science">Environmental Science</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Software Engineering">Software Engineering</option>
                <option value="Information Systems">Information Systems</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Statistics">Statistics</option>
                <option value="Psychology">Psychology</option>
                <option value="Sociology">Sociology</option>
                <option value="Political Science">Political Science</option>
                <option value="Economics">Economics</option>
                <option value="Anthropology">Anthropology</option>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Chinese">Chinese</option>
                <option value="Hebrew">Hebrew</option>
                <option value="Arabic">Arabic</option>
                <option value="Philosophy">Philosophy</option>
                <option value="History">History</option>
                <option value="Literature">Literature</option>
                <option value="Art History">Art History</option>
                <option value="Art">Art</option>
                <option value="Music">Music</option>
                <option value="Law">Law</option>
                <option value="Business Studies">Business Studies</option>
                <option value="Education">Education</option>
                <option value="Medicine">Medicine</option>
                <option value="Nursing">Nursing</option>
                <option value="Engineering">Engineering</option>
            </select>
        </div>

        <div class="mb-4">
            <label for="timeFilter">Sort Tips by Date:</label>
            <select id="timeFilter" class="dropdown-menu4 form-control">
                <option value="Newest">Newest First</option>
                <option value="Oldest">Oldest First</option>
            </select>
        </div>
        <div class="mb-4">
    <label for="likeFilter">Sort Tips by Likes:</label>
    <select id="likeFilter" class="dropdown-menu4 form-control">
        <option value="None">Default</option>
        <option value="Most">Most Liked</option>
        <option value="Least">Least Liked</option>
    </select>
</div>
<!-- Tips container -->
<div class="row" id="tipsContainer" runat="server" style="margin: 0;">
    <!-- Tip cards go here -->
</div>

    </div>
</div>


    <!-- JavaScript for filtering tips by subject -->
 <script>
     document.addEventListener("DOMContentLoaded", function () {
         const subjectFilter = document.getElementById("subjectFilter");
         const timeFilter = document.getElementById("timeFilter");
         const container = document.querySelector('#MainContent_tipsContainer');

         // Store original list of all tip cards
         const originalCards = Array.from(container.querySelectorAll(".tip-card"));

         function applyFilters() {
             const selectedSubject = subjectFilter.value.trim().toLowerCase();
             const timeOrder = timeFilter.value;

             // Filter cards based on selected subject
             let filtered = originalCards.filter(card => {
                 const cardSubject = card.getAttribute("data-subject").trim().toLowerCase();
                 return selectedSubject === "all" || cardSubject === selectedSubject;
             });

             // Sort filtered cards by date if time order is selected
             if (timeOrder === "Newest" || timeOrder === "Oldest") {
                 filtered.sort((a, b) => {
                     const dateA = new Date(a.getAttribute("data-date"));
                     const dateB = new Date(b.getAttribute("data-date"));
                     return timeOrder === "Newest" ? dateB - dateA : dateA - dateB;
                 });
             }

             // Clear the container and rebuild rows with sorted & filtered cards
             container.innerHTML = '';
             let row;
             filtered.forEach((card, index) => {
                 card.style.display = "block";
                 if (index % 3 === 0) {
                     row = document.createElement("div");
                     row.className = "row";
                     row.style.backgroundColor = "#f2f6fa";
                     container.appendChild(row);
                 }
                 row.appendChild(card);
             });
         }

         // Apply filters when user changes subject or time order
         subjectFilter.addEventListener("change", applyFilters);
         timeFilter.addEventListener("change", applyFilters);

         // Initial load
         applyFilters();
     });
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


     document.addEventListener("DOMContentLoaded", function () {
         const subjectFilter = document.getElementById("subjectFilter");
         const timeFilter = document.getElementById("timeFilter");
         const likeFilter = document.getElementById("likeFilter");
         const container = document.querySelector('#MainContent_tipsContainer');

         const originalCards = Array.from(container.querySelectorAll(".tip-card"));

         function applyFilters() {
             const selectedSubject = subjectFilter.value.trim().toLowerCase();
             const timeOrder = timeFilter.value;
             const likeOrder = likeFilter.value;

             let filtered = originalCards.filter(card => {
                 const cardSubject = card.getAttribute("data-subject").trim().toLowerCase();
                 return selectedSubject === "all" || cardSubject === selectedSubject;
             });

             // מיון לפי תאריך
             if (timeOrder === "Newest" || timeOrder === "Oldest") {
                 filtered.sort((a, b) => {
                     const dateA = new Date(a.getAttribute("data-date"));
                     const dateB = new Date(b.getAttribute("data-date"));
                     return timeOrder === "Newest" ? dateB - dateA : dateA - dateB;
                 });
             }

             // מיון לפי לייקים
             if (likeOrder === "Most" || likeOrder === "Least") {
                 filtered.sort((a, b) => {
                     const likesA = parseInt(a.querySelector(".like-btn").dataset.likes) || 0;
                     const likesB = parseInt(b.querySelector(".like-btn").dataset.likes) || 0;
                     return likeOrder === "Most" ? likesB - likesA : likesA - likesB;
                 });
             }

             container.innerHTML = '';
             let row;
             filtered.forEach((card, index) => {
                 card.style.display = "block";
                 if (index % 3 === 0) {
                     row = document.createElement("div");
                     row.className = "row";
                     row.style.backgroundColor = "#f2f6fa";
                     container.appendChild(row);
                 }
                 row.appendChild(card);
             });
         }

         // כל שלושת הדרופדאונים מאזינים לשינויים
         subjectFilter.addEventListener("change", applyFilters);
         timeFilter.addEventListener("change", applyFilters);
         likeFilter.addEventListener("change", applyFilters);

         // הרצה ראשונית
         applyFilters();
     });




 </script>



</asp:Content>
