package cn.duanap.siyu;

import java.net.URI;
import java.net.URISyntaxException;

final class NavigationPolicy {
    static final String APP_URL = "https://siyu.duanap.cn/";
    static final String APP_HOST = "siyu.duanap.cn";

    private NavigationPolicy() {}

    static boolean isFirstPartyHttps(String rawUrl) {
        if (rawUrl == null) return false;
        try {
            URI uri = new URI(rawUrl);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && APP_HOST.equalsIgnoreCase(uri.getHost());
        } catch (URISyntaxException error) {
            return false;
        }
    }

    static boolean isExternalWebLink(String rawUrl) {
        if (rawUrl == null) return false;
        try {
            String scheme = new URI(rawUrl).getScheme();
            return "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme);
        } catch (URISyntaxException error) {
            return false;
        }
    }
}
