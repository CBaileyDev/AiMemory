use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::net::TcpStream;
use tokio::time::{sleep, timeout, Duration, Instant};

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

const WORKER_HOST: &str = "127.0.0.1";
const WORKER_PORT: u16 = 37777;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(20);
const POLL_INTERVAL: Duration = Duration::from_millis(250);
const CONNECT_TIMEOUT: Duration = Duration::from_millis(500);
const MAIN_WINDOW: &str = "main";

async fn worker_alive() -> bool {
    matches!(
        timeout(CONNECT_TIMEOUT, TcpStream::connect((WORKER_HOST, WORKER_PORT))).await,
        Ok(Ok(_))
    )
}

async fn wait_for_worker() -> bool {
    let deadline = Instant::now() + HEALTH_TIMEOUT;
    while Instant::now() < deadline {
        if worker_alive().await {
            return true;
        }
        sleep(POLL_INTERVAL).await;
    }
    false
}

async fn ensure_worker(app_handle: &AppHandle) {
    if worker_alive().await {
        log::info!("Worker already running on :{WORKER_PORT}, attaching");
    } else {
        log::info!("Worker not running on :{WORKER_PORT}, spawning sidecar");
        match app_handle.shell().sidecar("claude-mem-worker") {
            Ok(cmd) => match cmd.args(["--daemon"]).spawn() {
                Ok((mut rx, _child)) => {
                    log::info!("Sidecar spawned");
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => log::info!(
                                    "[worker] {}",
                                    String::from_utf8_lossy(&line).trim_end()
                                ),
                                CommandEvent::Stderr(line) => log::warn!(
                                    "[worker] {}",
                                    String::from_utf8_lossy(&line).trim_end()
                                ),
                                _ => {}
                            }
                        }
                    });
                }
                Err(e) => log::error!("Failed to spawn sidecar: {e}"),
            },
            Err(e) => log::warn!(
                "Sidecar binary unavailable (dev mode without compiled worker?): {e}"
            ),
        }
    }

    if !wait_for_worker().await {
        log::warn!(
            "Worker not healthy within {}s — opening window anyway",
            HEALTH_TIMEOUT.as_secs()
        );
    }
}

fn build_main_window(app_handle: &AppHandle) -> tauri::Result<WebviewWindow> {
    let url = format!("http://localhost:{WORKER_PORT}");
    let parsed: url::Url = url
        .parse()
        .expect("hard-coded worker URL is always parseable");

    let mut builder = WebviewWindowBuilder::new(app_handle, MAIN_WINDOW, WebviewUrl::External(parsed))
        .title("Claude-Mem")
        .inner_size(1400.0, 900.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .decorations(false)
        .transparent(true);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(LogicalPosition::new(18.0, 20.0));
    }

    #[cfg(target_os = "windows")]
    {
        // Mica is only available on Windows 11; the call gracefully no-ops on
        // older versions. Acrylic is the fallback path applied below if needed.
        builder = builder.shadow(true);
    }

    let window = builder.build()?;
    apply_window_effects(&window);
    Ok(window)
}

fn apply_window_effects(window: &WebviewWindow) {
    use tauri::utils::config::{WindowEffect, WindowEffectState, WindowEffectsConfig};

    #[cfg(target_os = "macos")]
    let effects = WindowEffectsConfig {
        effects: vec![WindowEffect::HudWindow, WindowEffect::Sidebar],
        state: Some(WindowEffectState::Active),
        radius: Some(12.0),
        color: None,
    };

    #[cfg(target_os = "windows")]
    let effects = WindowEffectsConfig {
        effects: vec![WindowEffect::Mica, WindowEffect::Acrylic, WindowEffect::Blur],
        state: None,
        radius: None,
        color: None,
    };

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let effects = WindowEffectsConfig {
        effects: vec![],
        state: None,
        radius: None,
        color: None,
    };

    if effects.effects.is_empty() {
        return;
    }
    if let Err(e) = window.set_effects(Some(effects)) {
        log::warn!("Window effects unavailable on this platform: {e}");
    }
}

fn show_and_focus(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    } else {
        // Window was closed (hidden to tray). Recreate it.
        if let Err(e) = build_main_window(app_handle) {
            log::error!("Failed to recreate main window: {e}");
        }
    }
}

fn toggle_main_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW) {
        match window.is_visible() {
            Ok(true) if window.is_focused().unwrap_or(false) => {
                let _ = window.hide();
            }
            _ => {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
    } else if let Err(e) = build_main_window(app_handle) {
        log::error!("Failed to open main window: {e}");
    }
}

fn emit_to_window(app_handle: &AppHandle, event: &str, payload: &str) {
    show_and_focus(app_handle);
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW) {
        if let Err(e) = window.emit(event, payload) {
            log::warn!("Failed to emit {event}: {e}");
        }
    }
}

fn install_tray(app_handle: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app_handle, "open", "Open Claude-Mem", true, None::<&str>)?;
    let ask = MenuItem::with_id(app_handle, "ask", "Ask…", true, Some("Cmd+Shift+J"))?;
    let search = MenuItem::with_id(
        app_handle,
        "search",
        "Search memory…",
        true,
        Some("Cmd+Shift+K"),
    )?;
    let separator = PredefinedMenuItem::separator(app_handle)?;
    let quit = MenuItem::with_id(app_handle, "quit", "Quit Claude-Mem", true, Some("Cmd+Q"))?;

    let menu = Menu::with_items(app_handle, &[&open, &ask, &search, &separator, &quit])?;

    let icon = app_handle
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("default window icon".into()))?;

    TrayIconBuilder::with_id("main")
        .tooltip("Claude-Mem · persistent AI memory")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(icon)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_and_focus(app),
            "ask" => emit_to_window(app, "claude-mem://ask", ""),
            "search" => emit_to_window(app, "claude-mem://palette", ""),
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app_handle)?;

    Ok(())
}

#[cfg(desktop)]
fn install_global_shortcuts(app_handle: &AppHandle) -> tauri::Result<()> {
    let toggle = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyM);
    let palette = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyK);
    let ask = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyJ);

    let handle_clone = app_handle.clone();
    let toggle_for_handler = toggle.clone();
    let palette_for_handler = palette.clone();
    let ask_for_handler = ask.clone();
    app_handle.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |_app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                if shortcut == &toggle_for_handler {
                    toggle_main_window(&handle_clone);
                } else if shortcut == &palette_for_handler {
                    emit_to_window(&handle_clone, "claude-mem://palette", "");
                } else if shortcut == &ask_for_handler {
                    emit_to_window(&handle_clone, "claude-mem://ask", "");
                }
            })
            .build(),
    )?;

    let gs = app_handle.global_shortcut();
    if let Err(e) = gs.register(toggle) {
        log::warn!("Failed to register Cmd+Shift+M: {e}");
    }
    if let Err(e) = gs.register(palette) {
        log::warn!("Failed to register Cmd+Shift+K: {e}");
    }
    if let Err(e) = gs.register(ask) {
        log::warn!("Failed to register Cmd+Shift+J: {e}");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .on_window_event(|window, event| {
            // Hide-to-tray instead of quit when the user closes the main window.
            if window.label() == MAIN_WINDOW {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                if let Err(e) = install_global_shortcuts(app.handle()) {
                    log::warn!("Global shortcuts unavailable: {e}");
                }
            }

            if let Err(e) = install_tray(app.handle()) {
                log::warn!("System tray unavailable: {e}");
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ensure_worker(&app_handle).await;
                if let Err(e) = build_main_window(&app_handle) {
                    log::error!("Failed to create main window: {e}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
