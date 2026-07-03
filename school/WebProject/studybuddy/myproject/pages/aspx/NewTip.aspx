<%@ Page Language="C#" CodeFile="../cs/NewTip.aspx.cs" Inherits="Namespace.NewTip" MasterPageFile="../Master/Site.Master"  %>

<asp:Content ID="Content2" ContentPlaceHolderID="MainContent" runat="server">
<asp:ScriptManager ID="ScriptManager1" runat="server" EnablePageMethods="true" />

    <h1 class="text-center my-4">Submit a New Tip</h1>
    
    <link rel="stylesheet" type="text/css" href="/css/Site.css">

    <div class="container my-5">
        <!-- Tip Name -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="txtTipName" runat="server" CssClass="form-control slippery-snail" placeholder=" " ClientIDMode="Static"/>
            <label for="txtTipName">Tip Name</label>
            <asp:Label ID="TipNameError" runat="server" CssClass="badge bg-danger text-white mt-1" Text="Tip Name is required and must be 2-50 characters long." style="display:none;"  />
        </div>

        <!-- Select Subject -->
        <div class="form-floating mb-3">
            <asp:DropDownList ID="ddlSubjects" runat="server" CssClass="form-control slippery-snail" AutoPostBack="false">
                <asp:ListItem Text="-- Select Subject --" Value="" />
                <asp:ListItem Text="Biology" Value="Biology" />
                <asp:ListItem Text="Chemistry" Value="Chemistry" />
                <asp:ListItem Text="Physics" Value="Physics" />
                <asp:ListItem Text="Geography" Value="Geography" />
                <asp:ListItem Text="Environmental Science" Value="EnvironmentalScience" />
                <asp:ListItem Text="Computer Science" Value="ComputerScience" />
                <asp:ListItem Text="Software Engineering" Value="SoftwareEngineering" />
                <asp:ListItem Text="Information Systems" Value="InformationSystems" />
                <asp:ListItem Text="Mathematics" Value="Mathematics" />
                <asp:ListItem Text="Statistics" Value="Statistics" />
                <asp:ListItem Text="Psychology" Value="Psychology" />
                <asp:ListItem Text="Sociology" Value="Sociology" />
                <asp:ListItem Text="Political Science" Value="PoliticalScience" />
                <asp:ListItem Text="Economics" Value="Economics" />
                <asp:ListItem Text="Anthropology" Value="Anthropology" />
                <asp:ListItem Text="English" Value="English" />
                <asp:ListItem Text="Spanish" Value="Spanish" />
                <asp:ListItem Text="French" Value="French" />
                <asp:ListItem Text="German" Value="German" />
                <asp:ListItem Text="Chinese" Value="Chinese" />
                <asp:ListItem Text="Hebrew" Value="Hebrew" />
                <asp:ListItem Text="Arabic" Value="Arabic" />
                <asp:ListItem Text="Philosophy" Value="Philosophy" />
                <asp:ListItem Text="History" Value="History" />
                <asp:ListItem Text="Literature" Value="Literature" />
                <asp:ListItem Text="Art History" Value="ArtHistory" />
                <asp:ListItem Text="Art" Value="Art" />
                <asp:ListItem Text="Music" Value="Music" />
                <asp:ListItem Text="Law" Value="Law" />
                <asp:ListItem Text="Business Studies" Value="BusinessStudies" />
                <asp:ListItem Text="Education" Value="Education" />
                <asp:ListItem Text="Medicine" Value="Medicine" />
                <asp:ListItem Text="Nursing" Value="Nursing" />
                <asp:ListItem Text="Engineering" Value="Engineering" />
            </asp:DropDownList>
            <asp:Label ID="SubjectError" runat="server" CssClass="badge bg-danger text-white mt-1" Text="Please select a subject." style="display:none;" />
        </div>

        <!-- Tip Text -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="txtTipText" runat="server" TextMode="MultiLine" Rows="4" CssClass="form-control slippery-snail" placeholder=" " ClientIDMode="Static"/>
            <label for="txtTipText">Tell Us Your Tip</label>
            <asp:Label ID="TipTextError" runat="server" CssClass="badge bg-danger text-white mt-1" Text="The tip text is required must be between 2 and 50 characters long." style="display:none;"  />
        </div>

        <!-- File Upload -->
        <div class="form-floating mb-3">
            <asp:FileUpload ID="FileUpload1" runat="server" CssClass="form-control slippery-snail" />
            <asp:Label ID="FileUpload1Error" runat="server" CssClass="badge bg-danger text-white mt-1" Text="" style="display:none;"  />

        </div>

        <!-- Submit Button -->
        <div class="text-center mt-3">
<asp:Button ID="btnSubmit" runat="server" CssClass="button" Text="Submit"  OnClick="btnSubmit_Click" />
        </div>

        <asp:Label ID="ResultLabel" runat="server" CssClass="result-label" Text="" />
    </div>

    <style>
        /* עיצוב הכפתור והקלטים */
        /*.slippery-snail {
            position: relative;
            padding: 10px;
            border: 2px solid transparent;
            background-color: #ffe5e5;
            border-radius: 12px;
            transition: all 0.3s ease;
        }

        .slippery-snail:hover {
            border-color: #ff0000;
        }*/

        

        .container {
            max-width: 400px;
            margin: auto;
            padding: 20px;
            text-align: center;

        }

/* שגיאות */
.badge.bg-danger {
    display: inline-block;   /* מאפשר לתיבה להתאים לאורך הטקסט */
    box-sizing: border-box;  /* לכלול את הריפוד והגבולות ברוחב */
    text-align: left;
    padding: 10px;           /* הוספת ריפוד פנימי */
    width: auto;             /* התאם את הרוחב לפי הטקסט */
    min-width: 150px;        /* הגדרת רוחב מינימלי שימנע מהתיבה להיות קטנה מדי */
    white-space: normal;     /* מאפשר חיתוך שורות באופן טבעי */
    margin-top: 10px;        /* רווח בין השגיאה לשדה הקודם */
}





        .result-label {
            margin-top: 15px;
            text-align: center;
            font-weight: bold;
        }
    </style>

<%--      <script type="text/javascript">
          function submitTip(event) {
              __doPostBack('<%= btnSubmit.ClientID %>', '');  // מפעיל את btnSubmit_Click בשרת
              return false;
        }
      </script>--%>

</asp:Content>
