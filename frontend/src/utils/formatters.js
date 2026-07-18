export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") {
    return "0 €";
  }

  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
};

export const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  return Number(value).toLocaleString("fr-FR");
};

export const formatDate = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("fr-FR");
};
