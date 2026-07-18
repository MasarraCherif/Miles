import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Search,
  FileX,
  MoreHorizontal,
  Plus,
  Filter,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import ErrorBanner from "../components/ErrorBanner.jsx";

import apiClient from "../services/api.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";

const STATUS_FILTERS = [
  { key: "ALL", label: "Tous" },
  { key: "IMPAYÉ", label: "Impayé" },
  { key: "PARTIELLEMENT_PAYÉ", label: "Partiel" },
  { key: "PAYÉ", label: "Payé" },
];

const statusBadgeClass = (status) => {
  switch (status) {
    case "IMPAYÉ":
      return "danger";

    case "PARTIELLEMENT_PAYÉ":
      return "warning";

    case "PAYÉ":
      return "success";

    default:
      return "neutral";
  }
};

const riskBadgeClass = (level) => {
  switch (level) {
    case "CRITIQUE":
      return "danger";

    case "ÉLEVÉ":
      return "warning";

    case "MOYEN":
      return "info";

    case "BAS":
      return "success";

    default:
      return "neutral";
  }
};

const initials = (name = "") =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const altFor = (id = 0) => ((id % 4) + 1);

const Impayes = () => {
  const [searchParams] = useSearchParams();

  const [impayes, setImpayes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [offset] = useState(0);

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [query, setQuery] = useState("");

  const [showNewForm, setShowNewForm] =
    useState(false);

  const [newImpaye, setNewImpaye] = useState({
    nom_client: "",
    numero_contrat: "",
    montant_impaye: "",
    statut_paiement: "IMPAYÉ",
    niveau_risque: "MOYEN",
  });

  const limit = 50;

  useEffect(() => {
    fetchImpayes();
  }, [offset]);

  useEffect(() => {
    setQuery(searchParams.get("search") || "");
  }, [searchParams]);

  // =========================
  // FETCH IMPAYES
  // =========================

  const fetchImpayes = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await apiClient.getImpayes(
          limit,
          offset
        );

      setImpayes(response?.data || []);
    } catch (err) {
      console.error(err);

      setError(
        "Impossible de charger les impayés."
      );

      setImpayes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDossier = async () => {
  try {
    await apiClient.post("/impayes", {
      nom_client: newImpaye.nom_client,
      numero_contrat: newImpaye.numero_contrat,
      montant_impaye: Number(newImpaye.montant_impaye),
      statut_paiement: newImpaye.statut_paiement,
      niveau_risque: newImpaye.niveau_risque,
    });

    setShowNewForm(false);

    setNewImpaye({
      nom_client: "",
      numero_contrat: "",
      montant_impaye: "",
      statut_paiement: "IMPAYÉ",
      niveau_risque: "MOYEN",
    });

    fetchImpayes();
    alert("Dossier ajouté avec succès");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Erreur lors de l'ajout du dossier");
  }
};


  // =========================
  // COUNTS
  // =========================

  const counts = useMemo(() => {
    const map = {
      ALL: impayes.length,
    };

    impayes.forEach((item) => {
      map[item.statut_paiement] =
        (map[item.statut_paiement] || 0) + 1;
    });

    return map;
  }, [impayes]);

  // =========================
  // FILTERED DATA
  // =========================

  const filtered = useMemo(() => {
    return impayes.filter((row) => {
      const matchStatus =
        statusFilter === "ALL" ||
        row.statut_paiement === statusFilter;

      const q = query.trim().toLowerCase();

      const matchQuery =
        !q ||
        row.nom_client
          ?.toLowerCase()
          .includes(q) ||
        String(row.numero_contrat || "")
          .toLowerCase()
          .includes(q);

      return matchStatus && matchQuery;
    });
  }, [impayes, statusFilter, query]);

  // =========================
  // TOTAL
  // =========================

  const totalAmount = useMemo(() => {
    return filtered.reduce(
      (acc, row) =>
        acc + Number(row.montant_impaye || 0),
      0
    );
  }, [filtered]);

  // =========================
  // EXPORT CSV
  // =========================

  const handleExport = () => {
    const headers = [
      "Client",
      "Contrat",
      "Montant",
      "Statut",
      "Risque",
      "Date",
    ];

    const rows = filtered.map((row) => [
      row.nom_client || "",
      row.numero_contrat || "",
      row.montant_impaye || "",
      row.statut_paiement || "",
      row.niveau_risque || "",
      row.date_impaye || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((line) =>
        line
          .map(
            (value) =>
              `"${String(value).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.setAttribute(
      "download",
      "impayes_export.csv"
    );

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  };

  // =========================
  // INPUT CHANGE
  // =========================

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setNewImpaye((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================
  // ADD IMPAYE
  // =========================

  const handleAddImpaye = () => {
    if (
      !newImpaye.nom_client ||
      !newImpaye.numero_contrat ||
      !newImpaye.montant_impaye
    ) {
      alert(
        "Veuillez remplir tous les champs."
      );

      return;
    }

    const newItem = {
      impaye_id: Date.now(),

      nom_client: newImpaye.nom_client,

      numero_contrat:
        newImpaye.numero_contrat,

      montant_impaye: Number(
        newImpaye.montant_impaye
      ),

      statut_paiement:
        newImpaye.statut_paiement,

      niveau_risque:
        newImpaye.niveau_risque,

      date_impaye: new Date().toISOString(),
    };

    setImpayes((prev) => [
      newItem,
      ...prev,
    ]);

    setNewImpaye({
      nom_client: "",
      numero_contrat: "",
      montant_impaye: "",
      statut_paiement: "IMPAYÉ",
      niveau_risque: "MOYEN",
    });

    setShowNewForm(false);
  };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <LoadingSpinner message="Chargement des impayés..." />
    );
  }

  return (
    <div className="page-container">
      {/* HEADER */}

      <div className="page-header">
        <div>
          <span className="page-eyebrow">
            <Filter size={11} />
            Opérations
          </span>

          <h1 className="page-title-pro">
            Impayés
          </h1>

          <p className="page-subtitle">
            <span className="num">
              {filtered.length}
            </span>

            dossier
            {filtered.length > 1 ? "s" : ""}

            <span className="dot-sep" />

            Total :

            <b className="num">
              {formatCurrency(totalAmount)}
            </b>

            <span className="dot-sep" />

            Mise à jour il y a 2 minutes
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={handleExport}
          >
            <Download size={14} />
            Exporter
          </button>

          <button
            className="btn btn-primary"
            onClick={() =>
              setShowNewForm(true)
            }
          >
            <Plus size={14} />
            Nouveau dossier
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => setError("")}
        />
      )}

      {/* TABLE WRAP */}

      <div className="table-wrap">
        {/* TOOLBAR */}

        <div className="table-toolbar">
          <div className="filter-chips">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                className={`chip ${
                  statusFilter === filter.key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setStatusFilter(filter.key)
                }
              >
                {filter.label}

                <span className="count num">
                  {counts[filter.key] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* SEARCH */}

          <div
            className="search"
            style={{ width: 280 }}
          >
            <Search
              size={14}
              color="var(--text-3)"
            />

            <input
              type="text"
              placeholder="Rechercher client, contrat..."
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
            />
          </div>
        </div>

        {/* FORM */}

        {showNewForm && (
          <div
            style={{
              background: "#fff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "20px",
              boxShadow:
                "0 8px 20px rgba(0,0,0,0.06)",
            }}
          >
            <h3
              style={{
                marginBottom: "16px",
              }}
            >
              Nouveau dossier
            </h3>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              <input
                type="text"
                name="nom_client"
                placeholder="Nom du client"
                className="input"
                value={newImpaye.nom_client}
                onChange={
                  handleInputChange
                }
              />

              <input
                type="text"
                name="numero_contrat"
                placeholder="Numéro de contrat"
                className="input"
                value={
                  newImpaye.numero_contrat
                }
                onChange={
                  handleInputChange
                }
              />

              <input
                type="number"
                name="montant_impaye"
                placeholder="Montant impayé"
                className="input"
                value={
                  newImpaye.montant_impaye
                }
                onChange={
                  handleInputChange
                }
              />

              <select
                name="statut_paiement"
                className="input"
                value={
                  newImpaye.statut_paiement
                }
                onChange={
                  handleInputChange
                }
              >
                <option value="IMPAYÉ">
                  IMPAYÉ
                </option>

                <option value="PARTIELLEMENT_PAYÉ">
                  PARTIELLEMENT PAYÉ
                </option>

                <option value="PAYÉ">
                  PAYÉ
                </option>
              </select>

              <select
                name="niveau_risque"
                className="input"
                value={
                  newImpaye.niveau_risque
                }
                onChange={
                  handleInputChange
                }
              >
                <option value="CRITIQUE">
                  CRITIQUE
                </option>

                <option value="ÉLEVÉ">
                  ÉLEVÉ
                </option>

                <option value="MOYEN">
                  MOYEN
                </option>

                <option value="BAS">
                  BAS
                </option>
              </select>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                }}
              >
           <button
  className="btn btn-primary"
  onClick={handleSaveDossier}
>
  Enregistrer
</button>


                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setShowNewForm(false)
                  }
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TABLE */}

        <div
          style={{
            overflowX: "auto",
          }}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Risque</th>
                <th>Date</th>
                <th>Contrat</th>
                <th
                  style={{
                    width: 40,
                  }}
                ></th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div
                      className="empty-state"
                      style={{
                        border: "none",
                        margin: 0,
                        padding:
                          "32px 16px",
                      }}
                    >
                      <FileX size={28} />

                      <h4>
                        Aucun impayé trouvé
                      </h4>

                      <p>
                        Essayez de modifier
                        les filtres ou la
                        recherche.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.impaye_id}
                  >
                    <td>
                      <div className="client-cell">
                        <div
                          className={`client-avatar alt-${altFor(
                            row.impaye_id
                          )}`}
                        >
                          {initials(
                            row.nom_client
                          )}
                        </div>

                        <div>
                          <div className="cell-strong">
                            {row.nom_client ||
                              "N/A"}
                          </div>

                          <div
                            className="cell-muted"
                            style={{
                              fontSize: 12,
                            }}
                          >
                            ID #
                            {
                              row.impaye_id
                            }
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="cell-strong num">
                      {formatCurrency(
                        row.montant_impaye
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${statusBadgeClass(
                          row.statut_paiement
                        )}`}
                      >
                        {row.statut_paiement ||
                          "N/A"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${riskBadgeClass(
                          row.niveau_risque
                        )}`}
                      >
                        {row.niveau_risque ||
                          "N/A"}
                      </span>
                    </td>

                    <td className="cell-muted num">
                      {formatDate(
                        row.date_impaye
                      )}
                    </td>

                    <td className="cell-muted">
                      {row.numero_contrat ||
                        "N/A"}
                    </td>

                    <td>
                      <button
                        className="row-action"
                        title="Actions"
                      >
                        <MoreHorizontal
                          size={14}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Impayes;