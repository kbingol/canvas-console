import { Badge } from "@fluentui/react-components";
import { useConsole } from "../lib/console-context";
import { CopyButton, PageHeading } from "../components/console-ui";

export function SettingsPage() {
  const { data } = useConsole();
  const session = data!.session;
  return (
    <section className="page-content wide-page settings-page">
      <PageHeading
        title="Ayarlar"
        description="Hesap ve çalışma alanı bilgilerin."
      />
      <h2 className="section-heading">Profil</h2>
      <dl className="profile-list">
        <div>
          <dt>Ad</dt>
          <dd>{session.name}</dd>
        </div>
        <div>
          <dt>E-posta</dt>
          <dd>{session.email}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>
            <Badge appearance="outline" color="subtle">
              {session.role === "admin" ? "Yönetici" : "Üye"}
            </Badge>
          </dd>
        </div>
      </dl>
      <div className="section-divider" />
      <h2 className="section-heading">Çalışma alanı</h2>
      <dl className="profile-list">
        <div>
          <dt>Ad</dt>
          <dd>{session.workspaceName}</dd>
        </div>
        <div>
          <dt>Çalışma alanı kimliği</dt>
          <dd className="inline-copy">
            <code>{session.workspaceId}</code>
            <CopyButton
              value={session.workspaceId}
              label="Çalışma alanı kimliğini kopyala"
            />
          </dd>
        </div>
        <div>
          <dt>Oturum</dt>
          <dd>
            {session.mode === "demo"
              ? "Yerel önizleme"
              : "Firebase ile doğrulandı"}
          </dd>
        </div>
      </dl>
      <div className="section-divider" />
      <h2 className="section-heading">API bağlantısı</h2>
      <p className="secondary-text">
        Model kataloğunda her sağlayıcının native endpoint ve parametre biçimini
        bulabilirsin. Erişim anahtarları API anahtarları sayfasından yönetilir.
      </p>
      {session.mode === "demo" ? (
        <p className="preview-notice">
          Bu, yerel bir ürün önizlemesidir. Örnek kullanım, bakiye ve hesap
          hareketleri gerçek sağlayıcı trafiğini temsil etmez.
        </p>
      ) : null}
    </section>
  );
}
