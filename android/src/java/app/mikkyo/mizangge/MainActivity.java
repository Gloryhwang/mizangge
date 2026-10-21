package app.mikkyo.mizangge;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * 密藏阁 — 零依赖 WebView 壳。
 * 用 https://mzg.local/ 虚拟域映射 assets/www/，使前端 fetch 同源可用。
 */
public class MainActivity extends Activity {

    private static final String HOST = "https://mzg.local/";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "MzgNative");
        web.setWebViewClient(new LocalClient());
        web.loadUrl(HOST + "index.html");
        paintStatusBar("light");
    }

    /** 返回键：阅读器内先回目录 */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.mzgBack ? window.mzgBack() : 'false';", v -> {
            if (v == null || v.contains("false")) finish();
        });
    }

    private void paintStatusBar(String theme) {
        Window w = getWindow();
        boolean ink = "ink".equals(theme);
        w.setStatusBarColor(Color.parseColor(ink ? "#000000" : "#f5efe2"));
        int flags = w.getDecorView().getSystemUiVisibility();
        if (ink) {
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        } else {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }
        w.getDecorView().setSystemUiVisibility(flags);
    }

    private class Bridge {
        @JavascriptInterface
        public void setTheme(String theme) {
            runOnUiThread(() -> paintStatusBar(theme));
        }
    }

    /** 虚拟域资源拦截：https://mzg.local/xyz → assets/www/xyz */
    private class LocalClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            return serve(req);
        }

        private WebResourceResponse serve(WebResourceRequest req) {
            String url = req.getUrl().toString();
            if (!url.startsWith(HOST)) return null;
            String path = url.substring(HOST.length()).split("\\?")[0].split("#")[0];
            if (path.isEmpty()) path = "index.html";
            if (path.contains("..")) return notFound();
            try {
                InputStream is = getAssets().open("www/" + path);
                String mime = mimeOf(path);
                return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript")
                        ? "utf-8" : null, is);
            } catch (IOException e) {
                return notFound();
            }
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8",
                    new ByteArrayInputStream("404".getBytes(StandardCharsets.UTF_8)));
        }

        private String mimeOf(String p) {
            if (p.endsWith(".html")) return "text/html";
            if (p.endsWith(".css")) return "text/css";
            if (p.endsWith(".js")) return "application/javascript";
            if (p.endsWith(".json")) return "application/json";
            if (p.endsWith(".png")) return "image/png";
            if (p.endsWith(".svg")) return "image/svg+xml";
            if (p.endsWith(".woff2")) return "font/woff2";
            if (p.endsWith(".ttf")) return "font/ttf";
            if (p.endsWith(".md")) return "text/plain";
            return "application/octet-stream";
        }
    }
}
