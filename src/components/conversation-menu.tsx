import { Brain, ChevronRight, Download, FileJson, History, Info, Pencil, Trash2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import type { Character } from "@/lib/characters";
import { SCENE_COMMANDS } from "@/lib/characters";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type ConversationMenuTab = "guide" | "settings";

type PersonaOption = { id: string; name: string };

type Props = {
  open: boolean;
  tab: ConversationMenuTab;
  onTabChange: (tab: ConversationMenuTab) => void;
  onOpenChange: (open: boolean) => void;
  character: Character;
  portraitSrc: string;
  personas: PersonaOption[];
  personaId: string;
  onPersonaChange: (id: string) => void;
  onEditPersona: () => void;
  aiProvider: string;
  providerLabels: Record<string, string>;
  onProviderChange: (provider: string) => void;
  knowledgeMode: string;
  knowledgeModeLabels: Record<string, string>;
  onKnowledgeModeChange: (mode: string) => void;
  showThoughts: boolean;
  onThoughtsChange: (value: boolean) => void;
  busy: boolean;
  exporting: boolean;
  blocked: boolean;
  onCommand: (id: (typeof SCENE_COMMANDS)[number]["id"]) => void;
  onShowCharacter: () => void;
  onShowHistory: () => void;
  onShowMemory: () => void;
  onExport: (format: "txt" | "json") => void;
  onEditCharacter: () => void;
  canEditCharacter: boolean;
  onClearHistory: () => void;
};

function OptionRow({
  label, description, children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 shrink-0">{children}</div>
    </div>
  );
}

function SettingsAction({
  label, icon: Icon, onClick, disabled, destructive = false,
}: {
  label: string;
  icon: typeof Brain;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex min-h-12 w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 " +
        (destructive ? "text-destructive" : "text-foreground")
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden="true" />
    </button>
  );
}

export function ConversationMenu(props: Props) {
  const {
    open, tab, onTabChange, onOpenChange, character, portraitSrc,
    personas, personaId, onPersonaChange, onEditPersona,
    aiProvider, providerLabels, onProviderChange,
    knowledgeMode, knowledgeModeLabels, onKnowledgeModeChange,
    showThoughts, onThoughtsChange, busy, blocked, exporting,
    onCommand, onShowCharacter, onShowHistory, onShowMemory,
    onExport, onEditCharacter, canEditCharacter, onClearHistory,
  } = props;

  const selectedPersona = personas.find((persona) => persona.id === personaId);
  const switchTo = (target: ConversationMenuTab) => onTabChange(target);
  const openAction = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.25rem)] max-w-xl gap-0 overflow-y-auto rounded-3xl border-border/60 bg-background p-0 shadow-2xl sm:w-[calc(100%-2rem)]">
        <div className="relative overflow-hidden px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
          <div className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
          <DialogTitle className="relative pr-8 text-2xl font-bold tracking-tight sm:text-3xl">Guie a sua história</DialogTitle>
          <DialogDescription className="relative mt-2 text-sm">
            Escolha como conduzir a narrativa ou ajuste as preferências da conversa.
          </DialogDescription>

          <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-3">
            {portraitSrc ? (
              <img src={portraitSrc} alt="" className="size-12 shrink-0 rounded-full border border-border object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-xl" aria-hidden="true">{character.avatar}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{character.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Persona: {selectedPersona?.name ?? "Sem persona"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Trocar persona"
              className="shrink-0 rounded-full"
              onClick={() => switchTo("settings")}
            >
              <UserRound className="size-4" />
              <span className="sr-only">Configurar persona</span>
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="Menu da conversa" className="grid grid-cols-2 border-b border-border/60 px-4 sm:px-6">
          <button
            type="button"
            role="tab"
            id="hysto-guide-tab"
            aria-controls="hysto-guide-panel"
            aria-selected={tab === "guide"}
            onClick={() => switchTo("guide")}
            className={"relative px-2 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-base " +
              (tab === "guide" ? "text-foreground after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground")}
          >
            Guie a sua história
          </button>
          <button
            type="button"
            role="tab"
            id="hysto-settings-tab"
            aria-controls="hysto-settings-panel"
            aria-selected={tab === "settings"}
            onClick={() => switchTo("settings")}
            className={"relative px-2 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-base " +
              (tab === "settings" ? "text-foreground after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground")}
          >
            Configurações
          </button>
        </div>

        {tab === "guide" ? (
          <section role="tabpanel" id="hysto-guide-panel" aria-labelledby="hysto-guide-tab" className="space-y-3 px-5 pb-7 pt-6 sm:px-7">
            <h3 className="text-sm font-semibold text-muted-foreground">Comandos rápidos</h3>
            <div className="overflow-hidden rounded-2xl border border-border bg-secondary/20">
              {SCENE_COMMANDS.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  disabled={busy || blocked}
                  onClick={() => openAction(() => onCommand(command.id))}
                  className="flex w-full flex-col gap-1 border-b border-border/60 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-sm font-semibold text-foreground">{command.icon} {command.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{command.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section role="tabpanel" id="hysto-settings-panel" aria-labelledby="hysto-settings-tab" className="space-y-5 px-5 pb-7 pt-6 sm:px-7">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Bate-papo</h3>
              <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border bg-secondary/20">
                <OptionRow label="Modelo de IA" description="Provedor das próximas respostas">
                  <Select value={aiProvider} onValueChange={onProviderChange} disabled={busy}>
                    <SelectTrigger aria-label="Modelo de IA" className="h-9 w-[142px] border-border/60 bg-background text-xs sm:w-[174px]">
                      <SelectValue>{providerLabels[aiProvider] ?? "Automático"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(providerLabels).map(([id, label]) => (
                        <SelectItem key={id} value={id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </OptionRow>
                <OptionRow label="Persona" description="Quem participa da história">
                  <div className="flex items-center gap-1">
                    <Select value={personaId} onValueChange={onPersonaChange} disabled={busy}>
                      <SelectTrigger aria-label="Persona da conversa" className="h-9 w-[115px] border-border/60 bg-background text-xs sm:w-[144px]">
                        <SelectValue>{selectedPersona?.name ?? "Sem persona"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem persona</SelectItem>
                        {personas.map((persona) => <SelectItem key={persona.id} value={persona.id}>{persona.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" disabled={busy}
                      aria-label={personaId === "none" ? "Criar persona" : "Editar persona"}
                      onClick={() => openAction(onEditPersona)}
                      className="size-9 shrink-0">
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </OptionRow>
                <OptionRow label="Pensamentos do personagem" description="Exibir e gerar pensamentos internos">
                  <Switch checked={showThoughts} onCheckedChange={onThoughtsChange} disabled={busy} aria-label="Mostrar pensamentos" />
                </OptionRow>
                <OptionRow label="Repertório do personagem" description="O quanto ele conhece referências">
                  <Select value={knowledgeMode} onValueChange={onKnowledgeModeChange} disabled={busy || blocked}>
                    <SelectTrigger aria-label="Repertório do personagem" className="h-9 w-[142px] border-border/60 bg-background text-xs sm:w-[174px]">
                      <SelectValue>{knowledgeModeLabels[knowledgeMode] ?? "Cauteloso"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(knowledgeModeLabels).map(([id, label]) => (
                        <SelectItem key={id} value={id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </OptionRow>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Memória e personagem</h3>
              <div className="overflow-hidden rounded-2xl border border-border bg-secondary/20">
                <SettingsAction label="Memória da história" icon={Brain} onClick={() => openAction(onShowMemory)} />
                <SettingsAction label="Ver personagem" icon={Info} onClick={() => openAction(onShowCharacter)} />
                {canEditCharacter && <SettingsAction label="Editar personagem" icon={Pencil} onClick={() => openAction(onEditCharacter)} />}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Histórico e backup</h3>
              <div className="overflow-hidden rounded-2xl border border-border bg-secondary/20">
                <SettingsAction label="Mensagens desde o início" icon={History} onClick={() => openAction(onShowHistory)} />
                <SettingsAction label={exporting ? "Exportando..." : "Exportar história (.txt)"} icon={Download}
                  disabled={exporting || busy || blocked} onClick={() => openAction(() => onExport("txt"))} />
                <SettingsAction label="Exportar backup completo (.json)" icon={FileJson}
                  disabled={exporting || busy || blocked} onClick={() => openAction(() => onExport("json"))} />
                <SettingsAction label="Limpar conversa" icon={Trash2} destructive disabled={busy || blocked}
                  onClick={() => openAction(onClearHistory)} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">As opções alteram as próximas respostas. O histórico já salvo permanece intacto, salvo se você escolher excluí-lo.</p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
