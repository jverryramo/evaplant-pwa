// ============================================================
// Contacts — Répertoire des contacts client
// ============================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, Trash2, Phone, Mail, User, Building2, X, Check } from "lucide-react";
import Layout from "@/components/Layout";
import { useApp } from "@/contexts/AppContext";
import type { ClientContact } from "@/lib/types";
import { generateId } from "@/lib/types";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function ContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ClientContact;
  onSave: (c: ClientContact) => void;
  onCancel: () => void;
}) {
  const { activeContext } = useApp();
  const [name, setName] = useState(initial?.name ?? "");
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? activeContext?.client ?? "");

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    onSave({
      id: initial?.id ?? generateId(),
      name: name.trim(),
      titre: titre.trim(),
      email: email.trim(),
      telephone: telephone.trim(),
      clientName: clientName.trim(),
    });
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-3 mb-4"
      style={{ background: "#F5F0EA", border: "2px solid #003D39" }}
    >
      <div className="text-sm font-semibold text-gray-900 mb-1">
        {initial ? "Modifier le contact" : "Nouveau contact"}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom complet *"
        className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
        style={{ borderColor: "#DDCCBF" }}
      />
      <input
        type="text"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        placeholder="Titre / Poste"
        className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
        style={{ borderColor: "#DDCCBF" }}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Courriel"
        className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
        style={{ borderColor: "#DDCCBF" }}
      />
      <input
        type="tel"
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        placeholder="Téléphone"
        className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
        style={{ borderColor: "#DDCCBF" }}
      />
      <input
        type="text"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        placeholder="Client associé"
        className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none"
        style={{ borderColor: "#DDCCBF" }}
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#DDCCBF", color: "#5a3e28" }}
        >
          <X size={14} />
          Annuler
        </button>
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#003D39", color: "#DCF21E" }}
        >
          <Check size={14} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [, navigate] = useLocation();
  const { contacts, saveContactEntry, deleteContactEntry, activeContext } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientContact | null>(null);

  if (!activeContext) {
    navigate("/");
    return null;
  }

  const filtered = contacts.filter(
    (c) => !c.clientName || c.clientName === activeContext.client
  );

  const handleSave = async (contact: ClientContact) => {
    await saveContactEntry(contact);
    setShowForm(false);
    setEditTarget(null);
    toast.success("Contact enregistré");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteContactEntry(deleteTarget.id);
    setDeleteTarget(null);
    toast.success("Contact supprimé");
  };

  return (
    <Layout title="(1.3) Contacts client" showBack onBack={() => navigate("/operations")}>
      <div className="px-4 pt-4">
        {/* Bouton ajouter */}
        {!showForm && !editTarget && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-sm mb-5 transition-all active:scale-95"
            style={{ background: "#003D39", color: "#DCF21E" }}
          >
            <Plus size={18} />
            Ajouter un contact
          </button>
        )}

        {/* Formulaire nouveau contact */}
        {showForm && (
          <ContactForm
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Formulaire édition */}
        {editTarget && (
          <ContactForm
            initial={editTarget}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
          />
        )}

        {/* Liste des contacts */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <User size={40} color="#DDCCBF" className="mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun contact</p>
            <p className="text-xs text-gray-300 mt-1">
              Ajoutez des contacts pour ce client
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className="terrain-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: "#003D39", color: "#DCF21E" }}
                      >
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">
                          {contact.name}
                        </div>
                        {contact.titre && (
                          <div className="text-xs text-gray-500">{contact.titre}</div>
                        )}
                      </div>
                    </div>

                    {contact.clientName && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                        <Building2 size={11} />
                        {contact.clientName}
                      </div>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1.5 mt-1 text-xs"
                        style={{ color: "#003D39" }}
                      >
                        <Mail size={11} />
                        {contact.email}
                      </a>
                    )}
                    {contact.telephone && (
                      <a
                        href={`tel:${contact.telephone}`}
                        className="flex items-center gap-1.5 mt-1 text-xs"
                        style={{ color: "#003D39" }}
                      >
                        <Phone size={11} />
                        {contact.telephone}
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setEditTarget(contact)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-xs font-medium"
                      style={{ color: "#8A7049" }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleteTarget(contact)}
                      className="p-2 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le contact ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
