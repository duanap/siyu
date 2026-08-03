package cn.duanap.siyu;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;

public final class MainActivity extends Activity {
    private WebView webView;
    private View loadingView;
    private View errorView;
    private boolean mainFrameFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.web_view);
        loadingView = findViewById(R.id.loading_view);
        errorView = findViewById(R.id.error_view);
        Button retryButton = findViewById(R.id.retry_button);

        configureWebView();
        retryButton.setOnClickListener(view -> loadHome());
        if (savedInstanceState == null) loadHome();
        else webView.restoreState(savedInstanceState);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (NavigationPolicy.isFirstPartyHttps(url)) return false;
                if (NavigationPolicy.isExternalWebLink(url)) openExternal(url);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (NavigationPolicy.isFirstPartyHttps(url)) {
                    mainFrameFailed = false;
                    showLoading();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (NavigationPolicy.isFirstPartyHttps(url) && !mainFrameFailed) showContent();
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    showError();
                }
            }
        });
    }

    private void loadHome() {
        showLoading();
        webView.loadUrl(NavigationPolicy.APP_URL);
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (RuntimeException ignored) {
            // Reject links when no safe external handler is available.
        }
    }

    private void showLoading() {
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.INVISIBLE);
        loadingView.setVisibility(View.VISIBLE);
    }

    private void showContent() {
        loadingView.setVisibility(View.GONE);
        errorView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void showError() {
        loadingView.setVisibility(View.GONE);
        webView.setVisibility(View.INVISIBLE);
        errorView.setVisibility(View.VISIBLE);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        webView.stopLoading();
        webView.setWebViewClient(null);
        webView.destroy();
        super.onDestroy();
    }
}
