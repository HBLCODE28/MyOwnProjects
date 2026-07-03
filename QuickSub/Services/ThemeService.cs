using System.Windows;
using System.Windows.Media;
using QuickSub.Models;

namespace QuickSub.Services;

public sealed class ThemeService
{
    public void Apply(AppTheme theme)
    {
        ResourceDictionary resources = Application.Current.Resources;

        if (theme == AppTheme.Light)
        {
            Set(resources, "WindowBackgroundBrush", "#F2F4F8");
            Set(resources, "PanelBackgroundBrush", "#FFFFFF");
            Set(resources, "PanelSecondaryBrush", "#E9EDF4");
            Set(resources, "TextPrimaryBrush", "#171A21");
            Set(resources, "TextSecondaryBrush", "#5D6675");
            Set(resources, "BorderBrush", "#D2D8E2");
        }
        else
        {
            Set(resources, "WindowBackgroundBrush", "#111318");
            Set(resources, "PanelBackgroundBrush", "#1B1F27");
            Set(resources, "PanelSecondaryBrush", "#242A35");
            Set(resources, "TextPrimaryBrush", "#F4F6FA");
            Set(resources, "TextSecondaryBrush", "#A9B0BE");
            Set(resources, "BorderBrush", "#343B48");
        }
    }

    private static void Set(ResourceDictionary resources, string key, string color)
    {
        resources[key] = new SolidColorBrush((Color)ColorConverter.ConvertFromString(color));
    }
}
