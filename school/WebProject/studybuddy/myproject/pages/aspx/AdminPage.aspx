<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/AdminPage.aspx.cs" Inherits="AdminPageNameSpace.AdminPage" MasterPageFile="../Master/Site.Master" %>

<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <h1>Welcome, <%= Session["UserName"] %>!</h1>

    <div class="scroll-container-wrapper">
        <!-- גלילה אופקית עליונה -->
        <div id="fakeScrollbar" class="fake-scrollbar"></div>

        <!-- עוטף את הטבלה ומאפשר גלילה -->
        <div id="realScrollWrapper" class="table-scroll-wrapper">
            <asp:Literal ID="LiteralTable" runat="server" />
        </div>
    </div>

    <style>
        .scroll-container-wrapper {
            position: relative;
            width: 100%;
            max-width: 100%;
        }

        .fake-scrollbar {
            height: 20px;
            overflow-x: auto;
            overflow-y: hidden;
        }

        .fake-scrollbar::after {
            content: '';
            display: block;
            width: 2000px; /* זה אמור להיות שווה לרוחב של הטבלה בפועל */
            height: 1px;
        }

        .table-scroll-wrapper {
            overflow-x: auto;
            width: 100%;
            margin-top: -20px; /* מזיז את מיכל הגלילה קרוב לסרגל העליון */
        }

        #dataTable {
            width: 2000px; /* אותו רוחב כמו ב־fake-scrollbar */
            border-collapse: collapse;
            table-layout: auto;
        }

        th, td {
            white-space: nowrap;
            padding: 8px;
            border: 1px solid #ccc;
        }

        th {
            position: sticky;
            top: 0;
            background-color: white;
            z-index: 2;
            cursor: pointer;
        }

        th.asc::after {
            content: " ▲";
        }

        th.desc::after {
            content: " ▼";
        }

        body {
            overflow-y: auto;
            overflow-x: hidden;
        }
    </style>

    <script type="text/javascript">
        // קוד לסנכרון בין שני הסרגלים
        document.addEventListener("DOMContentLoaded", function () {
            const fakeScrollbar = document.getElementById("fakeScrollbar");
            const realScrollWrapper = document.getElementById("realScrollWrapper");

            fakeScrollbar.addEventListener("scroll", function () {
                realScrollWrapper.scrollLeft = fakeScrollbar.scrollLeft;
            });

            realScrollWrapper.addEventListener("scroll", function () {
                fakeScrollbar.scrollLeft = realScrollWrapper.scrollLeft;
            });
        });

        // מיון טבלה
        let currentSort = [];

        function sortTable(colIndex, order) {
            let table = document.getElementById("dataTable");
            let rows = Array.from(table.rows).slice(1); // exclude header
            if (currentSort[0] === colIndex) {
                currentSort[1] = currentSort[1] === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort = [colIndex, order || 'asc'];
            }

            rows.sort(function (a, b) {
                let cellA = a.cells[colIndex].innerText.trim();
                let cellB = b.cells[colIndex].innerText.trim();

                let numA = parseFloat(cellA);
                let numB = parseFloat(cellB);

                if (!isNaN(numA) && !isNaN(numB)) {
                    return currentSort[1] === 'asc' ? numA - numB : numB - numA;
                }

                return currentSort[1] === 'asc'
                    ? cellA.localeCompare(cellB)
                    : cellB.localeCompare(cellA);
            });

            rows.forEach(row => table.appendChild(row));
            updateSortIndicator(colIndex);
        }

        function updateSortIndicator(colIndex) {
            let ths = document.querySelectorAll("#dataTable th");
            ths.forEach((th, index) => {
                if (index === colIndex) {
                    th.classList.add(currentSort[1]);
                    th.classList.remove(currentSort[1] === 'asc' ? 'desc' : 'asc');
                } else {
                    th.classList.remove('asc', 'desc');
                }
            });
        }
    </script>
</asp:Content>
