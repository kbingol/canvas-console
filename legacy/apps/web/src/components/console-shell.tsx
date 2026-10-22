import type { ReactNode } from "react";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  OverlayDrawer,
} from "@fluentui/react-components";
import {
  AppsRegular,
  ArrowExitRegular,
  ChevronDownRegular,
  DataHistogramRegular,
  DismissRegular,
  KeyRegular,
  LayerRegular,
  NavigationRegular,
  PaymentRegular,
  PeopleRegular,
  ServerRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import type { Overview, PageId } from "@canvas-console/contracts";
import { money } from "./console-ui";

const personalNavigation = [
  { id: "models", label: "Modeller", icon: <LayerRegular /> },
  { id: "keys", label: "API anahtarları", icon: <KeyRegular /> },
  { id: "usage", label: "Kullanım", icon: <DataHistogramRegular /> },
  { id: "billing", label: "Bakiye ve ödemeler", icon: <PaymentRegular /> },
] as const;
const adminNavigation = [
  { id: "providers", label: "Sağlayıcılar", icon: <ServerRegular /> },
  { id: "customers", label: "Müşteriler", icon: <PeopleRegular /> },
] as const;

export function ConsoleShell({
  data,
  page,
  navigate,
  signOut,
  children,
}: {
  data: Overview;
  page: PageId;
  navigate: (id: PageId) => void;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const select = (id: PageId) => {
    navigate(id);
    setMobileOpen(false);
  };
  const nav = (
    <nav aria-label="Ana menü" className="side-navigation">
      <div className="workspace-label">
        <span>{data.session.workspaceName}</span>
        <ChevronDownRegular aria-hidden="true" />
      </div>
      <div className="nav-group">
        {personalNavigation.map((item) => (
          <Button
            key={item.id}
            appearance="subtle"
            icon={item.icon}
            className={`nav-item ${page === item.id ? "nav-selected" : ""}`}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => select(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {data.session.role === "admin" ? (
        <div className="nav-group admin-nav">
          <span className="nav-group-label">Yönetim</span>
          {adminNavigation.map((item) => (
            <Button
              key={item.id}
              appearance="subtle"
              icon={item.icon}
              className={`nav-item ${page === item.id ? "nav-selected" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => select(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="nav-group settings-nav">
        <Button
          appearance="subtle"
          icon={<SettingsRegular />}
          className={`nav-item ${page === "settings" ? "nav-selected" : ""}`}
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => select("settings")}
        >
          Ayarlar
        </Button>
      </div>
    </nav>
  );
  return (
    <div className="console-shell">
      <header className="topbar">
        <div className="brand-group">
          <Button
            appearance="subtle"
            className="mobile-menu-button"
            icon={<NavigationRegular />}
            aria-label="Menüyü aç"
            onClick={() => setMobileOpen(true)}
          />
          <a
            className="brand"
            href="#models"
            onClick={(event) => {
              event.preventDefault();
              select("models");
            }}
          >
            <AppsRegular aria-hidden="true" />
            <span>
              CANVAS <strong>CONSOLE</strong>
            </span>
          </a>
          {data.session.mode === "demo" ? (
            <Badge
              className="demo-badge"
              appearance="tint"
              color="subtle"
              size="small"
            >
              Yerel önizleme
            </Badge>
          ) : null}
        </div>
        <div className="header-actions">
          <span
            className="header-balance"
            aria-label={`Kullanılabilir bakiye ${money(data.wallet.balanceMicros)}`}
          >
            {money(data.wallet.balanceMicros)}
          </span>
          <Button
            className="header-topup"
            aria-label="Bakiye yükle"
            onClick={() => select("billing")}
          >
            <span className="topup-full-label">Bakiye yükle</span>
            <span className="topup-short-label" aria-hidden="true">
              Yükle
            </span>
          </Button>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                className="avatar-button"
                aria-label="Hesap menüsü"
              >
                <Avatar name={data.session.name} size={32} color="neutral" />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={() => select("settings")}>
                  {data.session.name}
                </MenuItem>
                <MenuItem
                  icon={<ArrowExitRegular />}
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    setSignOutError(null);
                    void signOut()
                      .catch((error) =>
                        setSignOutError(
                          error instanceof Error
                            ? error.message
                            : "Oturum kapatılamadı.",
                        ),
                      )
                      .finally(() => setSigningOut(false));
                  }}
                >
                  {signingOut ? "Çıkış yapılıyor…" : "Çıkış yap"}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </header>
      <aside className="desktop-sidebar">{nav}</aside>
      <OverlayDrawer
        position="start"
        open={mobileOpen}
        onOpenChange={(_, state) => setMobileOpen(state.open)}
        className="mobile-navigation"
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Menüyü kapat"
                icon={<DismissRegular />}
                onClick={() => setMobileOpen(false)}
              />
            }
          >
            Canvas Console
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>{nav}</DrawerBody>
      </OverlayDrawer>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {signOutError ? (
          <div className="shell-error" role="alert">
            {signOutError}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
