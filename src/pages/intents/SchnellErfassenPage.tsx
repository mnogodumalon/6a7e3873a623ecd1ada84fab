/**
 * Schnell Erfassen — 2-Schritt-Wizard zum schnellen Anlegen eines KlareErfassung-Eintrags.
 * Steps: 1) Grunddaten erfassen (titel, kategorie, datum) → 2) Details ergänzen (beschreibung, anmerkungen, status).
 * Reads: klareErfassung. Writes: klareErfassung (createKlareErfassungEntry, updateKlareErfassungEntry).
 * Composes: IntentWizardShell.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import { IconCheck, IconFileText } from '@tabler/icons-react';

const KATEGORIE_OPTIONS = LOOKUP_OPTIONS['klare_erfassung']?.['kategorie'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['klare_erfassung']?.['status'] ?? [];

export default function SchnellErfassenPage() {
  const { loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [titel, setTitel] = useState('');
  const [kategorieKey, setKategorieKey] = useState('');
  const [datum, setDatum] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 state — driven by the created record id
  const [createdRecordId, setCreatedRecordId] = useState<string | null>(null);
  const [beschreibung, setBeschreibung] = useState('');
  const [anmerkungen, setAnmerkungen] = useState('');
  const [statusKey, setStatusKey] = useState(STATUS_OPTIONS[0]?.key ?? 'offen');
  const [step2Submitting, setStep2Submitting] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleStep1Submit = async () => {
    if (!titel.trim()) {
      setStep1Error('Bitte gib einen Titel ein.');
      return;
    }
    setStep1Error(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { titel: titel.trim() };
      if (kategorieKey && kategorieKey !== 'none') payload.kategorie = kategorieKey;
      if (datum) payload.datum = datum;

      const result = await LivingAppsService.createKlareErfassungEntry(payload);
      setCreatedRecordId(result.record_id);
      await fetchAll();
      setStep(2);
    } catch (e) {
      setStep1Error('Fehler beim Anlegen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep2Submit = async () => {
    if (!createdRecordId) return;
    setStep2Submitting(true);
    setStep2Error(null);
    try {
      const payload: Record<string, unknown> = { status: statusKey };
      if (beschreibung.trim()) payload.beschreibung = beschreibung.trim();
      if (anmerkungen.trim()) payload.anmerkungen = anmerkungen.trim();

      await LivingAppsService.updateKlareErfassungEntry(createdRecordId, payload);
      await fetchAll();
      setDone(true);
    } catch (e) {
      setStep2Error('Fehler beim Speichern. Bitte versuche es erneut.');
    } finally {
      setStep2Submitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setTitel('');
    setKategorieKey('');
    setDatum('');
    setCreatedRecordId(null);
    setBeschreibung('');
    setAnmerkungen('');
    setStatusKey(STATUS_OPTIONS[0]?.key ?? 'offen');
    setDone(false);
    setStep1Error(null);
    setStep2Error(null);
  };

  const handleStep2Skip = () => {
    setDone(true);
  };

  return (
    <IntentWizardShell
      title="Schnell erfassen"
      subtitle="Neuen Eintrag in zwei Schritten anlegen"
      steps={[{ label: 'Grunddaten' }, { label: 'Details' }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Grunddaten */}
      {step === 1 && !done && (
        <div className="space-y-5 max-w-lg">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="titel">
              Titel <span className="text-destructive">*</span>
            </label>
            <Input
              id="titel"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="Worum geht es?"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="kategorie">
              Kategorie
            </label>
            <Select value={kategorieKey} onValueChange={setKategorieKey}>
              <SelectTrigger id="kategorie">
                <SelectValue placeholder="Kategorie wählen (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Kategorie</SelectItem>
                {KATEGORIE_OPTIONS.map(opt => (
                  <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="datum">
              Datum
            </label>
            <Input
              id="datum"
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
            />
          </div>

          {step1Error && (
            <p className="text-sm text-destructive">{step1Error}</p>
          )}

          <Button
            onClick={handleStep1Submit}
            disabled={submitting || !titel.trim()}
            className="w-full sm:w-auto"
          >
            {submitting ? 'Wird angelegt…' : 'Weiter zu Details'}
          </Button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && !done && (
        createdRecordId ? (
          <div className="space-y-5 max-w-lg">
            <p className="text-sm text-muted-foreground">
              Der Eintrag wurde angelegt. Ergänze jetzt optional weitere Details.
            </p>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="beschreibung">
                Beschreibung
              </label>
              <Textarea
                id="beschreibung"
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder="Beschreibe den Eintrag genauer…"
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="anmerkungen">
                Anmerkungen
              </label>
              <Textarea
                id="anmerkungen"
                value={anmerkungen}
                onChange={e => setAnmerkungen(e.target.value)}
                placeholder="Zusätzliche Hinweise…"
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="status">
                Status
              </label>
              <Select value={statusKey} onValueChange={setStatusKey}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {step2Error && (
              <p className="text-sm text-destructive">{step2Error}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleStep2Submit}
                disabled={step2Submitting}
              >
                {step2Submitting ? 'Wird gespeichert…' : 'Speichern & abschließen'}
              </Button>
              <Button
                variant="outline"
                onClick={handleStep2Skip}
                disabled={step2Submitting}
              >
                Überspringen
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Dieser Schritt braucht die Daten aus Schritt 1.</p>
            <Button variant="outline" onClick={() => setStep(1)}>Neu starten</Button>
          </div>
        )
      )}

      {/* Done state */}
      {done && (
        <div className="flex flex-col items-center py-12 space-y-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <IconCheck size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Eintrag erfasst!</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Der Eintrag wurde erfolgreich angelegt.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button onClick={handleReset}>
              <IconFileText size={16} className="shrink-0 mr-2" />
              Weiteren Eintrag erfassen
            </Button>
            <Button variant="outline" asChild>
              <a href="#/">Zurück zum Dashboard</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
