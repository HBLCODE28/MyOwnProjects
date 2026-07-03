Namespace myproject
    Public Class [Global]
        Inherits System.Web.HttpApplication

        Sub Application_Start(ByVal sender As Object, ByVal e As EventArgs)
            ' קוד שמופעל כאשר האפליקציה מתחילה
        End Sub

        Sub Session_Start(ByVal sender As Object, ByVal e As EventArgs)
            ' קוד שמופעל כאשר סשן חדש מתחיל
        End Sub

        Sub Application_BeginRequest(ByVal sender As Object, ByVal e As EventArgs)
            ' קוד שמופעל בכל בקשה חדשה
        End Sub

        Sub Application_Error(ByVal sender As Object, ByVal e As EventArgs)
            ' טיפול בשגיאות גלובליות
        End Sub

        Sub Session_End(ByVal sender As Object, ByVal e As EventArgs)
            ' קוד שמופעל כאשר הסשן מסתיים
        End Sub

        Sub Application_End(ByVal sender As Object, ByVal e As EventArgs)
            ' קוד שמופעל כאשר האפליקציה מסתיימת
        End Sub
    End Class
End Namespace
