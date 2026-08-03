package cn.duanap.siyu;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class NavigationPolicyTest {
    @Test
    public void allowsOnlyFirstPartyHttpsInsideTheApp() {
        assertTrue(NavigationPolicy.isFirstPartyHttps("https://siyu.duanap.cn/home"));
        assertTrue(NavigationPolicy.isFirstPartyHttps("HTTPS://SIYU.DUANAP.CN/account"));
        assertFalse(NavigationPolicy.isFirstPartyHttps("http://siyu.duanap.cn/home"));
        assertFalse(NavigationPolicy.isFirstPartyHttps("https://evil.example/?next=siyu.duanap.cn"));
        assertFalse(NavigationPolicy.isFirstPartyHttps("file:///etc/passwd"));
    }

    @Test
    public void recognizesOnlyHttpAndHttpsAsExternalWebLinks() {
        assertTrue(NavigationPolicy.isExternalWebLink("https://example.com"));
        assertTrue(NavigationPolicy.isExternalWebLink("http://example.com"));
        assertFalse(NavigationPolicy.isExternalWebLink("intent://example.com"));
        assertFalse(NavigationPolicy.isExternalWebLink("javascript:alert(1)"));
    }
}
