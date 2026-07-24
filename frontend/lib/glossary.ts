export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY = {
  pearson: {
    term: "Pearson correlation (r)",
    definition:
      "Measures how strongly two numeric columns move together in a straight-line way, from -1 (perfectly opposite) to +1 (perfectly together). 0 means no relationship.",
  },
  spearman: {
    term: "Spearman correlation (r)",
    definition:
      "Like Pearson, but checks whether two columns rise and fall together in the same order, even if the relationship isn't a straight line. Used when the data doesn't behave well enough for Pearson.",
  },
  cramers_v: {
    term: "Cramér's V",
    definition:
      "Measures how strongly two category columns (e.g. Region and Product Type) are related, from 0 (unrelated) to 1 (perfectly related) — the categorical equivalent of a correlation.",
  },
  pvalue: {
    term: "p-value",
    definition:
      "The probability this result could have happened by random chance alone. Below 0.05 is the usual cutoff for \"probably real, not a coincidence\" — shown here as significant.",
  },
  anova: {
    term: "ANOVA",
    definition:
      "A statistical test that checks whether a numeric value (e.g. Revenue) genuinely differs across groups (e.g. by Region), rather than the difference just being random noise.",
  },
  kruskal: {
    term: "Kruskal-Wallis",
    definition:
      "The same question as ANOVA — does a value really differ across groups — but used when the data doesn't follow a normal bell-curve, where ANOVA's assumptions break down.",
  },
  variance_explained: {
    term: "% of variance explained",
    definition:
      "Of all the differences you see in this metric, this is the percentage attributable specifically to this factor (e.g. Region). The rest comes from other causes not captured here.",
  },
  isolation_forest: {
    term: "Isolation Forest",
    definition:
      "Flags unusual rows by how easily they can be separated from the rest of the data — genuinely unusual rows isolate in fewer steps than normal ones.",
  },
  local_outlier_factor: {
    term: "Local Outlier Factor",
    definition:
      "Flags a row as unusual if it sits in a much sparser neighborhood than similar rows nearby — good at catching outliers that only look strange relative to a local cluster, not the whole dataset.",
  },
  one_class_svm: {
    term: "One-Class SVM",
    definition: "Learns the boundary of what \"normal\" data looks like, then flags anything that falls outside it.",
  },
  shap: {
    term: "SHAP",
    definition:
      "Shapley Additive Explanations — breaks down why a specific row was flagged, showing how much each column contributed to that decision.",
  },
  pagerank: {
    term: "PageRank",
    definition:
      "The same algorithm Google originally used to rank web pages — here it ranks which rows are most \"central\" or influential based on how they connect to others.",
  },
  centrality: {
    term: "Degree centrality",
    definition: "Counts how many direct connections a row has to other rows — more connections means more central.",
  },
  silhouette: {
    term: "Silhouette score",
    definition:
      "Measures how well-separated the automatically-chosen groups are, from -1 (badly grouped) to +1 (cleanly separated). Used to pick the right number of groups automatically, instead of guessing.",
  },
  mape: {
    term: "MAPE (Mean Absolute Percentage Error)",
    definition:
      "On average, how far off the forecast was, as a percentage. Lower is better — 10% MAPE means the forecast was typically within 10% of the actual value.",
  },
  rmse: {
    term: "RMSE (Root Mean Squared Error)",
    definition:
      "A measure of forecast accuracy in the same units as your data (e.g. dollars) that penalizes big misses more than small ones. Lower is better.",
  },
  r_squared: {
    term: "R²",
    definition:
      "The share of the variation in your data that the forecast model explains, from 0 to 1. Closer to 1 means a better fit to the historical pattern.",
  },
  holdout: {
    term: "Holdout / backtest",
    definition:
      "Before trusting a forecast model, it's tested on real historical periods it wasn't shown during training — like a practice exam — to see how accurate it actually would have been.",
  },
  great_expectations: {
    term: "Great Expectations",
    definition:
      "An open-source data-testing library that runs generic structural checks (row counts, uniqueness, missing values) as a sanity check, separate from IntelliVerse's own business-aware quality score.",
  },
  zscore: {
    term: "Z-score",
    definition:
      "How many standard deviations a value is from the average. A large z-score (typically beyond ±3) flags a value as unusually far from the norm.",
  },
  iqr: {
    term: "IQR (Interquartile Range)",
    definition:
      "The range between the 25th and 75th percentile of the data. Values far outside this range are flagged as outliers — used instead of z-score when the data is skewed.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
