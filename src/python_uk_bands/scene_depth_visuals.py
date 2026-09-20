"""Charts for the isolated ten-band scene-depth experiment."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, MultipleLocator, PercentFormatter
import pandas as pd

from .config import FUA_POPULATION_YEAR, PROJECT_ROOT
from .visuals import (
    HOUSE,
    _colors_for_highlighted_cities,
    _finish_chart,
    _new_chart,
)


SCENE_DEPTH_CHART_DIR = PROJECT_ROOT / "artifacts" / "scene_depth"


def plot_scene_depth_rank_comparison(
    rankings: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 1,
    filename: str = "chart_01_scene_depth_rank_comparison.png",
) -> Path:
    """Compare each city's rank under the three scene-depth variants."""
    plot_data = rankings.sort_values("rank", ascending=False).reset_index(drop=True)
    y_positions = list(range(len(plot_data)))

    figure_height = max(6.8, 0.46 * len(plot_data) + 2.2)
    _, ax = _new_chart(figsize=(10.5, figure_height))
    for y_position, row in zip(y_positions, plot_data.itertuples(index=False)):
        ranks = [row.untrimmed_rank, row.top_excluded_rank, row.rank]
        ax.plot(
            [min(ranks), max(ranks)],
            [y_position, y_position],
            color=HOUSE["rule"],
            linewidth=1.2,
            zorder=1,
        )

    method_styles = (
        ("untrimmed_rank", "All ten bands", -0.14, "o", HOUSE["page"], HOUSE["ink"]),
        (
            "top_excluded_rank",
            "Highest excluded",
            0,
            "s",
            HOUSE["warning_soft"],
            HOUSE["warning"],
        ),
        (
            "rank",
            "Highest and lowest excluded",
            0.14,
            "D",
            HOUSE["blue"],
            HOUSE["ink"],
        ),
    )
    for column, label, offset, marker, fill, edge in method_styles:
        ax.scatter(
            plot_data[column],
            [position + offset for position in y_positions],
            s=68,
            marker=marker,
            color=fill,
            edgecolor=edge,
            linewidth=1,
            label=label,
            zorder=2,
        )

    ax.set_yticks(y_positions, plot_data["city"])
    ax.set_xticks(range(1, len(plot_data) + 1))
    ax.set_xlim(0.5, len(plot_data) + 0.5)
    ax.set_xlabel("Area rank (1 is strongest)")
    ax.set_ylabel("")
    ax.grid(axis="x")
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper right")

    return _finish_chart(
        ax,
        number=number,
        title="City rank under three ten-band scoring variants",
        subtitle=(
            "Current global Spotify monthly listeners divided by "
            f"{FUA_POPULATION_YEAR} OECD FUA population · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )


def plot_raw_normalized_scene_depth_rank_comparison(
    rankings: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 4,
    filename: str = "chart_04_raw_normalized_scene_depth_ranks.png",
) -> Path:
    """Show rank movement across the three analytical views as a slopegraph."""

    stages = (
        ("raw_total_rank", "Raw total"),
        ("all_ten_rank", "Population normalized\n(primary)"),
        ("top_excluded_rank", "Largest band removed\n(sensitivity)"),
    )
    required_columns = {"city", *(column for column, _ in stages)}
    missing_columns = required_columns.difference(rankings.columns)
    if missing_columns:
        raise ValueError(
            f"Rankings are missing required columns: {sorted(missing_columns)}"
        )

    plot_data = rankings.sort_values("all_ten_rank").reset_index(drop=True)
    expected_ranks = set(range(1, len(plot_data) + 1))
    for column, _ in stages:
        if set(plot_data[column]) != expected_ranks:
            raise ValueError(f"{column} must contain each rank exactly once")

    highlighted_cities = tuple(plot_data.head(3)["city"])
    city_colors = dict(
        zip(
            plot_data["city"],
            _colors_for_highlighted_cities(
                plot_data["city"], highlighted_cities
            ),
            strict=True,
        )
    )
    x_positions = list(range(len(stages)))

    _, ax = _new_chart(figsize=(12.5, 7.2))
    for row in plot_data.itertuples(index=False):
        ranks = [getattr(row, column) for column, _ in stages]
        color = city_colors[row.city]
        highlighted = row.city in highlighted_cities
        ax.plot(
            x_positions,
            ranks,
            color=color,
            linewidth=2.1 if highlighted else 1.25,
            alpha=1 if highlighted else 0.72,
            marker="o",
            markersize=7 if highlighted else 5.5,
            markeredgecolor=HOUSE["ink"],
            markeredgewidth=0.6,
            zorder=3 if highlighted else 2,
        )
        for x_position, rank in zip(x_positions, ranks, strict=True):
            if x_position == 0:
                offset, alignment = (-7, 0), "right"
            elif x_position == x_positions[-1]:
                offset, alignment = (7, 0), "left"
            else:
                offset, alignment = (0, -11), "center"
            ax.annotate(
                row.city,
                (x_position, rank),
                xytext=offset,
                textcoords="offset points",
                ha=alignment,
                va="center",
                fontsize=8.2,
                color=HOUSE["ink_soft"],
                bbox={
                    "facecolor": HOUSE["page"],
                    "edgecolor": "none",
                    "pad": 0.6,
                    "alpha": 0.9,
                },
                zorder=4,
            )

    for x_position, (_, label) in zip(x_positions, stages, strict=True):
        ax.text(
            x_position,
            0.18,
            label,
            ha="center",
            va="top",
            fontsize=10,
            color=HOUSE["ink"],
        )

    rank_count = len(plot_data)
    ax.set_xlim(-0.34, len(stages) - 0.66)
    ax.set_ylim(rank_count + 0.55, 0)
    ax.set_xticks([])
    ax.set_yticks(range(1, rank_count + 1))
    ax.set_ylabel("Rank (1 is strongest)")
    ax.spines["bottom"].set_visible(False)

    return _finish_chart(
        ax,
        number=number,
        title="Area rank across three selected-catalogue views",
        subtitle=(
            "Three analytical views, not a time series · Primary top three highlighted · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )


def plot_ten_band_city_stack(
    bands: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 1,
    filename: str = "chart_01_city_band_stack.png",
) -> Path:
    """Plot each city's selected-band reach as ten shares summing to 100%."""

    city_totals = (
        bands.groupby("city")["monthly_listeners"]
        .sum()
        .sort_values()
    )
    cities = city_totals.index.tolist()
    segment_colors = [
        HOUSE["blue"],
        HOUSE["warning"],
        "#b05a7a",
        "#547a92",
        "#d4aa4a",
        "#c4879d",
        HOUSE["gray_blue"],
        HOUSE["blue_soft"],
        HOUSE["warning_soft"],
        HOUSE["paper_soft"],
    ]
    segment_text_colors = [
        HOUSE["page"],
        HOUSE["page"],
        HOUSE["page"],
        HOUSE["page"],
        HOUSE["ink"],
        HOUSE["ink"],
        HOUSE["ink"],
        HOUSE["ink"],
        HOUSE["ink"],
        HOUSE["ink"],
    ]

    figure_height = max(10.2, 0.82 * len(cities) + 2.0)
    figure = plt.figure(
        figsize=(16, figure_height),
        layout="constrained",
    )
    grid = figure.add_gridspec(
        1, 2, width_ratios=[1.65, 1.35], wspace=0.04
    )
    ax = figure.add_subplot(grid[0, 0])
    key_ax = figure.add_subplot(grid[0, 1])

    for y_position, city in enumerate(cities):
        city_bands = (
            bands.loc[bands["city"].eq(city)]
            .sort_values(
                ["monthly_listeners", "band"],
                ascending=[False, True],
            )
            .reset_index(drop=True)
        )
        if len(city_bands) != 10:
            raise ValueError(
                f"Expected ten bands for {city}; found {len(city_bands)}"
            )
        city_total = float(city_bands["monthly_listeners"].sum())
        if city_total <= 0:
            raise ValueError(
                f"Expected a positive monthly-listener total for {city}"
            )
        left = 0.0
        band_key: list[str] = []
        for position, row in city_bands.iterrows():
            share = float(row["monthly_listeners"]) / city_total
            ax.barh(
                y_position,
                share,
                left=left,
                height=0.62,
                color=segment_colors[position],
                edgecolor=HOUSE["ink"],
                linewidth=0.42,
            )
            if share >= 0.04:
                ax.text(
                    left + share / 2,
                    y_position,
                    str(position + 1),
                    ha="center",
                    va="center",
                    fontsize=7.2,
                    fontfamily="monospace",
                    color=segment_text_colors[position],
                )
            band_key.append(f"{position + 1} {row['band']}")
            left += share

        key_lines = [
            "  ·  ".join(band_key[:5]),
            "  ·  ".join(band_key[5:]),
        ]
        key_ax.text(
            0,
            y_position,
            "\n".join(key_lines),
            va="center",
            fontsize=7.7,
            linespacing=1.45,
            color=HOUSE["ink_soft"],
        )

    ax.set_yticks(range(len(cities)), cities)
    ax.set_xlim(0, 1)
    ax.xaxis.set_major_locator(MultipleLocator(0.2))
    ax.xaxis.set_major_formatter(PercentFormatter(xmax=1))
    ax.set_xlabel(
        "Share of the area's combined current global Spotify monthly listeners"
    )
    ax.set_ylabel("")
    ax.grid(axis="x")
    ax.set_axisbelow(True)
    key_ax.set_ylim(ax.get_ylim())
    key_ax.set_xlim(0, 1)
    key_ax.axis("off")

    return _finish_chart(
        ax,
        number=number,
        title="Selected-band composition within each area",
        subtitle=(
            "Every bar totals 100% · 1 is the area's largest selected band · "
            "numbers match the two-line key · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )


def plot_raw_city_totals(
    rankings: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 2,
    filename: str = "chart_02_raw_city_totals.png",
) -> Path:
    """Plot combined city reach before applying a population denominator."""

    plot_data = rankings.sort_values("all_ten_value")
    colors = [
        HOUSE["blue"] if rank <= 3 else HOUSE["gray_blue"]
        for rank in plot_data["raw_total_rank"]
    ]

    figure_height = max(6.2, 0.43 * len(plot_data) + 2.0)
    _, ax = _new_chart(figsize=(10, figure_height))
    bars = ax.barh(
        plot_data["city"],
        plot_data["all_ten_value"],
        color=colors,
        edgecolor=HOUSE["ink"],
        linewidth=0.5,
    )
    maximum = plot_data["all_ten_value"].max()
    ax.set_xlim(0, maximum * 1.18)
    ax.xaxis.set_major_locator(MultipleLocator(50_000_000))
    ax.xaxis.set_major_formatter(
        FuncFormatter(lambda value, _: f"{value / 1_000_000:.0f}m")
    )
    ax.set_xlabel("Combined current global Spotify monthly listeners")
    ax.set_ylabel("")
    ax.grid(axis="x")
    ax.set_axisbelow(True)
    for bar, value in zip(bars, plot_data["all_ten_value"]):
        ax.text(
            value + maximum * 0.018,
            bar.get_y() + bar.get_height() / 2,
            f"{value / 1_000_000:.1f}m",
            va="center",
            color=HOUSE["ink_soft"],
            fontfamily="monospace",
            fontsize=9.2,
        )

    return _finish_chart(
        ax,
        number=number,
        title="Current global Spotify reach before population normalization",
        subtitle=(
            "Raw sum across all ten selected bands per area · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )


def _plot_population_normalized_total(
    rankings: pd.DataFrame,
    *,
    score_column: str,
    rank_column: str,
    snapshot_date: str,
    retained_description: str,
    title: str,
    number: int,
    filename: str,
    output_dir: Path,
    tick_step: float,
    denominator_description: str,
) -> Path:
    """Plot one population-normalized city total from the scene-depth results."""
    plot_data = rankings.sort_values(score_column)
    colors = [
        HOUSE["blue"] if rank <= 3 else HOUSE["gray_blue"]
        for rank in plot_data[rank_column]
    ]

    figure_height = max(6.2, 0.43 * len(plot_data) + 2.0)
    _, ax = _new_chart(figsize=(10, figure_height))
    bars = ax.barh(
        plot_data["city"],
        plot_data[score_column],
        color=colors,
        edgecolor=HOUSE["ink"],
        linewidth=0.5,
    )
    maximum = plot_data[score_column].max()
    ax.set_xlim(0, maximum * 1.18)
    ax.xaxis.set_major_locator(MultipleLocator(tick_step))
    ax.set_xlabel(
        "Combined current global Spotify monthly listeners divided by population"
    )
    ax.set_ylabel("")
    ax.grid(axis="x")
    ax.set_axisbelow(True)
    for bar, value in zip(bars, plot_data[score_column]):
        ax.text(
            value + maximum * 0.018,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.1f}x",
            va="center",
            color=HOUSE["ink_soft"],
            fontfamily="monospace",
            fontsize=9.2,
        )

    return _finish_chart(
        ax,
        number=number,
        title=title,
        subtitle=(
            f"{retained_description} · {denominator_description} · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )


def plot_ten_band_population_normalized_total(
    rankings: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 1,
    filename: str = "chart_01_ten_band_population_normalized_total.png",
    denominator_description: str = (
        f"{FUA_POPULATION_YEAR} OECD FUA population denominator"
    ),
) -> Path:
    """Plot all ten selected bands relative to city population."""
    score_column = (
        "all_ten_ratio"
        if "all_ten_ratio" in rankings.columns
        else "untrimmed_ratio"
    )
    rank_column = (
        "all_ten_rank"
        if "all_ten_rank" in rankings.columns
        else "untrimmed_rank"
    )
    return _plot_population_normalized_total(
        rankings,
        score_column=score_column,
        rank_column=rank_column,
        snapshot_date=snapshot_date,
        retained_description="All ten selected bands",
        title="Current global Spotify reach across ten selected bands",
        number=number,
        filename=filename,
        output_dir=output_dir,
        tick_step=10,
        denominator_description=denominator_description,
    )


def plot_scene_depth_scores(
    rankings: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 2,
    filename: str = "chart_02_scene_depth_scores.png",
) -> Path:
    """Plot the population-normalized middle-eight trimmed mean."""
    score_column = "population_normalized_trimmed_mean"
    plot_data = rankings.sort_values(score_column)
    colors = [
        HOUSE["blue"] if rank <= 3 else HOUSE["gray_blue"]
        for rank in plot_data["rank"]
    ]

    _, ax = _new_chart()
    bars = ax.barh(
        plot_data["city"],
        plot_data[score_column],
        color=colors,
        edgecolor=HOUSE["ink"],
        linewidth=0.5,
    )
    maximum = plot_data[score_column].max()
    ax.set_xlim(0, maximum * 1.18)
    ax.xaxis.set_major_locator(MultipleLocator(0.5))
    ax.set_xlabel(
        "Mean current global Spotify monthly listeners divided by population"
    )
    ax.set_ylabel("")
    ax.grid(axis="x")
    ax.set_axisbelow(True)
    for bar, value in zip(bars, plot_data[score_column]):
        ax.text(
            value + maximum * 0.018,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.2f}x" if value < 0.1 else f"{value:.1f}x",
            va="center",
            color=HOUSE["ink_soft"],
            fontfamily="monospace",
            fontsize=9.2,
        )

    return _finish_chart(
        ax,
        number=number,
        title="Population-normalized trimmed mean",
        subtitle=(
            "Mean current global reach of middle eight divided by "
            f"{FUA_POPULATION_YEAR} OECD FUA population · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )


def plot_top_band_concentration(
    rankings: pd.DataFrame,
    *,
    snapshot_date: str,
    output_dir: Path = SCENE_DEPTH_CHART_DIR,
    number: int = 3,
    filename: str = "chart_03_top_band_concentration.png",
) -> Path:
    """Plot the share contributed by each city's largest selected band."""
    plot_data = rankings.sort_values("top_band_concentration")
    labels = (
        plot_data["city"]
        + "  ·  "
        + plot_data["highest_excluded_bands"]
    )
    colors = [
        HOUSE["warning"] if share >= 0.5 else HOUSE["blue"]
        for share in plot_data["top_band_concentration"]
    ]

    _, ax = _new_chart(figsize=(10.5, 6.8))
    bars = ax.barh(
        labels,
        plot_data["top_band_concentration"],
        color=colors,
        edgecolor=HOUSE["ink"],
        linewidth=0.5,
    )
    ax.set_xlim(0, 0.66)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:.0%}"))
    ax.xaxis.set_major_locator(MultipleLocator(0.1))
    ax.set_xlabel("Share of the ten-band city total")
    ax.set_ylabel("")
    ax.grid(axis="x")
    ax.set_axisbelow(True)
    for bar, value in zip(bars, plot_data["top_band_concentration"]):
        ax.text(
            value + 0.012,
            bar.get_y() + bar.get_height() / 2,
            f"{value:.1%}",
            va="center",
            color=HOUSE["ink_soft"],
            fontfamily="monospace",
            fontsize=9.2,
        )

    return _finish_chart(
        ax,
        number=number,
        title="Largest band share of each selected city total",
        subtitle=(
            "Before trimming · gold marks shares of at least 50% · "
            f"Spotify snapshot {snapshot_date}"
        ),
        filename=filename,
        output_dir=output_dir,
    )
