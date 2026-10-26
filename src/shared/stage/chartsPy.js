/**
 * Python glue for real charts on the Stage (matplotlib, see ./charts.js). The Pyodide worker
 * (src/modules/python/pyodide.worker.js) runs CHARTS_INSTALL_PY once, after
 * pyodide.loadPackage('matplotlib'), and only for a program that imports matplotlib:
 *
 * - forces the Agg backend (the worker has no page to draw a window on);
 * - replaces plt.show() (and Figure.show()) with one that saves every open figure as a PNG and
 *   hands it to the worker's `__hsStageChart(png, w, h, alt)`, then closes them, as real
 *   plt.show() does once its window is shut;
 * - hides matplotlib's "Glyph … missing from font" warning (an emoji in a label).
 *
 * Each run of such a program calls `_hs_charts_reset()` first (close every figure, back to the
 * default style) and `_hs_charts_flush()` after it finishes: a figure drawn on but never shown is
 * shown then, so a forgotten plt.show() still puts the chart on the Stage.
 *
 * Exported as plain text; nothing here runs in Node.
 */
import { CHART_PIXELS, MAX_CHART_PNG_CHARS } from './charts.js'

export const CHARTS_INSTALL_PY = `
import os as _hs_os
_hs_os.environ['MPLBACKEND'] = 'Agg'

def _hs_charts_install():
    import base64, io, warnings
    import matplotlib
    matplotlib.use('Agg', force=True)
    import matplotlib.pyplot as plt
    import matplotlib.figure
    import matplotlib.style
    from matplotlib.patches import Rectangle, Wedge
    import js

    warnings.filterwarnings('ignore', message=r'.*Glyph .* missing from')
    pixels_max = ${CHART_PIXELS}
    chars_max = ${MAX_CHART_PNG_CHARS}

    def raise_problem(problem):
        kind, _sep, message = problem.partition('|')
        error = {'TypeError': TypeError, 'ValueError': ValueError}.get(kind, RuntimeError)
        raise error(message) from None

    def count(n, word):
        return f"{n} {word}{'' if n == 1 else 's'}"

    def alt_text(fig):
        parts = []
        for ax in fig.get_axes():
            bits = []
            title = ax.get_title()
            bars = sum(1 for p in ax.patches if isinstance(p, Rectangle))
            slices = sum(1 for p in ax.patches if isinstance(p, Wedge))
            lines = len(ax.get_lines())
            dots = len(ax.collections)
            things = []
            if bars:
                things.append(count(bars, 'bar'))
            if slices:
                things.append(count(slices, 'slice'))
            if lines:
                things.append(count(lines, 'line'))
            if dots:
                things.append(count(dots, 'set') + ' of points')
            head = 'a chart'
            if title:
                head += f" titled '{title}'"
            if things:
                head += ' with ' + ', '.join(things)
            bits.append(head)
            if ax.get_xlabel():
                bits.append(f"across: {ax.get_xlabel()}")
            if ax.get_ylabel():
                bits.append(f"up: {ax.get_ylabel()}")
            parts.append(', '.join(bits))
        suptitle = getattr(fig, '_suptitle', None)
        head = f"'{suptitle.get_text()}': " if suptitle is not None and suptitle.get_text() else ''
        return head + ('; '.join(parts) if parts else 'an empty chart')

    def png_of(fig, pixels):
        w, h = fig.get_size_inches()
        dpi = pixels / max(w, h, 0.1)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=dpi, facecolor='white')
        data = base64.b64encode(buf.getvalue()).decode('ascii')
        return data, max(1, round(w * dpi)), max(1, round(h * dpi))

    def send(fig):
        pixels = pixels_max
        data, pw, ph = png_of(fig, pixels)
        while len(data) > chars_max and pixels > 250:
            pixels = int(pixels * 0.7)
            data, pw, ph = png_of(fig, pixels)
        problem = str(js.__hsStageChart(data, pw, ph, alt_text(fig)) or '')
        if problem:
            raise_problem(problem)

    def show(*args, **kwargs):
        """show(): puts every open chart on the Stage."""
        try:
            for n in plt.get_fignums():
                send(plt.figure(n))
        finally:
            plt.close('all')

    def figure_show(self, *args, **kwargs):
        send(self)

    plt.show = show
    matplotlib.figure.Figure.show = figure_show

    def reset():
        plt.close('all')
        # The documented reset: matplotlib's own default look, leaving the backend alone.
        matplotlib.style.use('default')
        # A little bigger than matplotlib's 10 so labels read on a projector.
        matplotlib.rcParams['font.size'] = 12

    def flush():
        if plt.get_fignums():
            show()

    return reset, flush

_hs_charts_reset, _hs_charts_flush = _hs_charts_install()
del _hs_charts_install
`

export const CHARTS_RESET_PY = '_hs_charts_reset()'
export const CHARTS_FLUSH_PY = '_hs_charts_flush()'
