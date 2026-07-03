<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/Upload.aspx.cs" Inherits="Upload" %>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>Upload File</title>
</head>
<body>
    <form id="form1" runat="server">
        <div>
            <asp:FileUpload ID="FileUpload1" runat="server" />
            <asp:Button ID="UploadButton" runat="server" Text="Upload" OnClick="UploadButton_Click" />
            <asp:Label ID="ResultLabel" runat="server" />
        </div>
    </form>
</body>
</html>
