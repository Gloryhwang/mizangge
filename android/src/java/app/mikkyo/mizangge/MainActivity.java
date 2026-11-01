package app.mikkyo.mizangge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * 密藏阁 — 零依赖 WebView 壳。
 * 用 https://mzg.local/ 虚拟域映射 assets/ 根目录，使前端 fetch 同源可用。
 */
public class MainActivity extends Activity {

    private static final String HOST = "https://mzg.local/";
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        /* Android 15+（targetSdk 35 起）强制 edge-to-edge：
           内容避让系统栏 / 挖孔 / 输入法，旧系统行为不变 */
        root.setOnApplyWindowInsetsListener((v, in) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets sb = in.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout()
                        | WindowInsets.Type.ime());
                v.setPadding(sb.left, sb.top, sb.right, sb.bottom);
                return WindowInsets.CONSUMED;
            }
            v.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(),
                    in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
            return in.consumeSystemWindowInsets();
        });

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
        int bg = Color.parseColor(ink ? "#000000" : "#f5efe2");
        /* edge-to-edge 下系统栏透出窗口背景，同步着色避免色差条 */
        w.setBackgroundDrawable(new ColorDrawable(bg));
        w.setStatusBarColor(bg);        /* API < 35 生效，其后由窗口背景接管 */
        w.setNavigationBarColor(bg);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(ink ? 0 : mask, mask);
            }
        } else {
            int flags = w.getDecorView().getSystemUiVisibility();
            if (ink) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            w.getDecorView().setSystemUiVisibility(flags);
        }
    }

    private class Bridge {
        @JavascriptInterface
        public void setTheme(String theme) {
            runOnUiThread(() -> paintStatusBar(theme));
        }

        /** 屏幕亮度：0.02–1.0（仅影响本应用窗口） */
        @JavascriptInterface
        public void setBrightness(float v) {
            final float val = Math.max(0.02f, Math.min(1f, v));
            runOnUiThread(() -> {
                Window w = getWindow();
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.screenBrightness = val;
                w.setAttributes(lp);
            });
        }
    }

    /** 虚拟域资源拦截：https://mzg.local/xyz → assets/www/xyz */
    private class LocalClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            /* 外链（GitHub 等）交给系统浏览器，不落进壳内被拦成 404 */
            if (!req.getUrl().toString().startsWith(HOST)) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl()));
                } catch (Exception ignored) {}
                return true;
            }
            return false;
        }

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
                InputStream is = getAssets().open(path);
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
