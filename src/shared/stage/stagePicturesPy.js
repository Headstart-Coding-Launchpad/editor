/**
 * Image Lab's part of the `stage` Python module (docs/authoring/stage.md "Image Lab"): appended
 * to STAGE_MODULE_PY (./stagePy.js), so it runs in the same module after the drawing calls.
 *
 * - rgb(r, g, b) → '#rrggbb', like hue(). Numbers are rounded and kept within 0–255, so
 *   arithmetic such as red(c) + 60 or (r + g + b) / 3 never needs min() or int().
 * - red(c), green(c), blue(c) → 0–255. '#rrggbb' (every library and snapshot pixel) is read here;
 *   any other colour (a name, '#rgb') asks the worker (__hsStageColour, ./pictures.js).
 *   An (r, g, b) tuple works too.
 * - load_image(name, size=32) and snapshot(size=32) → a flat list of '#rrggbb', row by row, from
 *   the worker (__hsStageImage / __hsStageSnapshot, src/modules/python/stagePictureBridge.js),
 *   which answers 'ok|rrggbbrrggbb…' or 'Kind|message'.
 * - recolour(picture, old, new) changes, in the list itself, every square that is colour old to
 *   new, so a later grid(picture, ...) draws it (2026-11-03, Python L1 L9 Secret spy photo). Exact
 *   match, no tolerance: colours are compared as '#rrggbb' however they are written (a name, any
 *   case, '#RRGGBB', an (r, g, b) tuple; names are asked of the worker once per call), whole
 *   numbers (from 0) as palette indexes, never mixed with colours. A list of rows is recoloured row
 *   by row; a tuple row (grid() draws those too) is replaced by a new tuple in the picture.
 *   Returns None, like list.sort().
 * - (r, g, b) tuples, as Pillow writes colours, work wherever a drawing call takes a colour:
 *   _draw is wrapped so every tuple of numbers in a shape's values, a grid's cells and its
 *   palette becomes '#rrggbb' before it is sent. A grid's own rows stay rows; with width= the
 *   list is one long list of cells.
 *
 * Exported as plain text; nothing here runs in Node.
 */
export const STAGE_PICTURES_PY = `

# ── Image Lab (src/shared/stage/stagePicturesPy.js) ─────────────────────────────────────────
__all__ += ['rgb', 'red', 'green', 'blue', 'load_image', 'snapshot']

_HS_HEX_DIGITS = frozenset('0123456789abcdef')


def _hs_given(value):
    if value is None or isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return "the text '" + value[:30] + "'"
    return 'a ' + type(value).__name__


def _hs_is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


# A number as a colour channel: rounded, and kept within 0-255.
def _hs_channel(fn, name, value):
    if not _hs_is_number(value):
        raise TypeError(fn + '(): ' + name + ' should be a number from 0 to 255, like 200, not ' + _hs_given(value)) from None
    if value != value or value in (float('inf'), float('-inf')):
        raise ValueError(fn + '(): ' + name + ' should be an ordinary number from 0 to 255') from None
    return int(max(0, min(255, value)) + 0.5)


def _hs_hex(r, g, b, fn='rgb'):
    return '#%02x%02x%02x' % (_hs_channel(fn, 'red', r), _hs_channel(fn, 'green', g), _hs_channel(fn, 'blue', b))


def _hs_is_colour_tuple(value):
    return isinstance(value, tuple) and len(value) in (3, 4) and all(_hs_is_number(n) for n in value)


def rgb(*args, **kwargs):
    """rgb(r, g, b): a colour from how much red, green and blue it has (each 0 to 255), as a hex
    string like '#ff8800'. rgb(255, 136, 0) is orange."""
    if len(args) == 1 and not kwargs and _hs_is_colour_tuple(args[0]):
        args = tuple(args[0][:3])
    names = ('r', 'g', 'b')
    values = list(args)
    for key in kwargs:
        if key not in names:
            raise TypeError('rgb() has no ' + key + '= — it takes r, g and b, like rgb(255, 136, 0)') from None
    for i, key in enumerate(names):
        if key in kwargs:
            if i < len(values):
                raise TypeError('rgb() got ' + key + ' twice') from None
            values.append(kwargs[key])
    if len(values) != 3:
        raise TypeError('rgb() needs three numbers: red, green and blue, each 0 to 255, like rgb(255, 136, 0)') from None
    return _hs_hex(values[0], values[1], values[2])


# Any Stage colour as '#rrggbb' (for red(), green(), blue()).
def _hs_colour_hex(fn, args, kwargs):
    if len(args) == 1 and not kwargs:
        value = args[0]
        if _hs_is_colour_tuple(value):
            return _hs_hex(value[0], value[1], value[2], fn)
        if isinstance(value, str):
            text = value.strip().lower()
            if len(text) == 7 and text[0] == '#' and _HS_HEX_DIGITS.issuperset(text[1:]):
                return text
    if _js is None:
        return '#000000'
    answer = str(_js.__hsStageColour(fn, _payload(fn, args, kwargs)) or '')
    if answer.startswith('ok|'):
        return answer[3:]
    _raise(answer or 'ValueError|' + fn + "(): give it a colour, like '#ff8800'")


def red(*args, **kwargs):
    """red(c): how much red is in colour c, from 0 to 255. red('#ff8800') is 255."""
    return int(_hs_colour_hex('red', args, kwargs)[1:3], 16)


def green(*args, **kwargs):
    """green(c): how much green is in colour c, from 0 to 255. green('#ff8800') is 136."""
    return int(_hs_colour_hex('green', args, kwargs)[3:5], 16)


def blue(*args, **kwargs):
    """blue(c): how much blue is in colour c, from 0 to 255. blue('#ff8800') is 0."""
    return int(_hs_colour_hex('blue', args, kwargs)[5:7], 16)


# The worker's answer 'ok|rrggbb…' as a list of '#rrggbb'.
def _hs_pixels(fn, answer):
    answer = str(answer or '')
    if answer.startswith('names|'):
        return answer[6:].split(',')
    if not answer.startswith('ok|'):
        _raise(answer or 'RuntimeError|' + fn + "() didn't work — press Run again")
    hexes = answer[3:]
    return ['#' + hexes[i:i + 6] for i in range(0, len(hexes), 6)]


def load_image(*args, **kwargs):
    """load_image(name, size=32): a picture from the Headstart image library, as one long list
    of colours, row by row. Draw it with grid(pixels, width=32). size can be 8, 16, 32 or 64."""
    if _js is None:
        return []
    return _hs_pixels('load_image', _js.__hsStageImage(_payload('load_image', args, kwargs)))


def snapshot(*args, **kwargs):
    """snapshot(size=32): what the Stage shows so far, as one long list of colours, row by row
    (shapes and grids; not text or emoji). Draw it with grid(pixels, width=32)."""
    if _js is None:
        return []
    return _hs_pixels('snapshot', _js.__hsStageSnapshot(_payload('snapshot', args, kwargs)))


_HS_SEE_THROUGH = frozenset(('transparent', 'none', 'clear'))
_HS_COLOUR_EXAMPLE = "'orange', '#ff8800' or rgb(255, 136, 0)"


# What a value matches as, for recolour(): '#rrggbb' for any colour however it is written, the
# number itself for a palette index, 'transparent' for a see-through word. A picture's value that
# is none of these gives None and never matches; old and new (strict) raise instead.
def _hs_match_key(value, known, strict=False, name='old'):
    if _hs_is_colour_tuple(value):
        return '#%02x%02x%02x' % tuple(int(max(0, min(255, n)) + 0.5) for n in value[:3])
    if _hs_is_number(value):
        return value
    if not isinstance(value, str):
        if strict:
            raise TypeError('recolour(): ' + name + ' should be a colour, like ' + _HS_COLOUR_EXAMPLE + ', not ' + _hs_given(value)) from None
        return None
    text = value.strip().lower()
    if text in known:
        return known[text]
    if len(text) == 7 and text[0] == '#' and _HS_HEX_DIGITS.issuperset(text[1:]):
        key = text
    elif text in _HS_SEE_THROUGH:
        key = 'transparent'
    elif _js is None:
        key = text
    else:
        answer = str(_js.__hsStageColour('recolour', _payload('recolour', [value], {})) or '')
        if answer.startswith('ok|'):
            key = answer[3:]
        elif strict:
            _raise(answer or 'ValueError|recolour(): ' + name + ' should be a colour, like ' + _HS_COLOUR_EXAMPLE)
        else:
            key = None
    known[text] = key
    return key


def _hs_palette_number(name, value):
    if isinstance(value, float) and not value.is_integer() or value != value:
        raise TypeError('recolour(): ' + name + ' should be a colour, or a whole number from 0 for a palette, like recolour(rows, 1, 2), not ' + _hs_given(value)) from None
    if value < 0:
        raise ValueError('recolour(): ' + name + ' is ' + _hs_given(value) + ', but palette numbers start at 0, like recolour(rows, 1, 2)') from None


# Is this item of a picture a row (a list, or a tuple that isn't one (r, g, b) colour)? Matches
# grid(), which draws list and tuple rows alike.
def _hs_is_row(item, numbers):
    if isinstance(item, list):
        return True
    return isinstance(item, tuple) and (numbers or not _hs_is_colour_tuple(item))


def recolour(*args, **kwargs):
    """recolour(picture, old, new): changes every square of the picture that is colour old to
    colour new, in the picture itself. recolour(spy, 'orange', 'royalblue') then grid(spy, width=16)."""
    example = "like recolour(spy, 'orange', 'blue')"
    names = ('picture', 'old', 'new')
    for key in kwargs:
        if key not in names:
            raise TypeError('recolour() has no ' + key + '= — it takes picture, old and new, ' + example) from None
    values = list(args)
    for i, key in enumerate(names):
        if key in kwargs:
            if i < len(values):
                raise TypeError('recolour(): ' + key + ' is given twice, once in its place and once as ' + key + '=. Give it once, ' + example) from None
            values.append(kwargs[key])
    if len(values) != 3:
        raise TypeError('recolour() needs three things: the picture, the colour to find and the colour to put instead, ' + example) from None
    picture, old, new = values
    if isinstance(picture, tuple):
        raise TypeError("recolour(): picture is a tuple, which can't be changed. Make it a list first, like spy = list(spy)") from None
    if not isinstance(picture, list):
        message = 'recolour(): picture should be a list of colours, like spy = load_image("pixel_fox", size=16), not ' + _hs_given(picture)
        if isinstance(picture, str):
            message += ". Use the picture's name without quotes, like recolour(spy, ...)"
        raise TypeError(message) from None
    known = {}
    find = _hs_match_key(old, known, True, 'old')
    _hs_match_key(new, known, True, 'new')
    numbers = _hs_is_number(old)
    if numbers:
        _hs_palette_number('old', old)
    if _hs_is_number(new):
        _hs_palette_number('new', new)
    if numbers != _hs_is_number(new):
        first, second = ('old', 'new') if numbers else ('new', 'old')
        raise TypeError('recolour(): ' + first + ' is a palette number but ' + second + " is a colour. Use two colours, like recolour(spy, 'orange', 'blue'), or two numbers, like recolour(rows, 1, 2)") from None
    put = _hs_tuple_colour(new)

    # The squares, row by row; a picture made only of the other kind of value gets a plain error.
    rows = [picture] + [row for row in picture if _hs_is_row(row, numbers)]
    has_number = has_colour = False
    for row in rows:
        for item in row:
            if _hs_is_row(item, numbers):
                continue
            if _hs_is_number(item):
                has_number = True
            elif isinstance(item, str) or _hs_is_colour_tuple(item):
                has_colour = True
    try:
        label = _hs_name_of(picture, _sys._getframe(1)) or 'the picture'
    except Exception:
        label = 'the picture'
    if numbers and has_colour and not has_number:
        raise TypeError('recolour(): ' + label + " is made of colours, not palette numbers, so old should be a colour, like recolour(spy, 'orange', 'blue')") from None
    if not numbers and has_number and not has_colour:
        raise TypeError('recolour(): ' + label + ' is made of palette numbers, not colours, so old should be a number, like recolour(rows, 1, 2)') from None

    def swap(items):
        changed = list(items)
        for i, item in enumerate(changed):
            if not _hs_is_row(item, numbers) and _hs_match_key(item, known) == find:
                changed[i] = put
        return changed

    picture[:] = swap(picture)
    for i, row in enumerate(picture):
        if isinstance(row, list):
            row[:] = swap(row)
        elif _hs_is_row(row, numbers):
            # A tuple row can't change, so the picture gets a new tuple in its place (only when
            # something in it changed).
            changed = tuple(swap(row))
            if changed != row:
                picture[i] = changed


__all__ += ['recolour']


def _hs_tuple_colour(value):
    if _hs_is_colour_tuple(value):
        return '#%02x%02x%02x' % tuple(int(max(0, min(255, n)) + 0.5) for n in value[:3])
    return value


# A call's values with every (r, g, b) tuple that is a colour turned into '#rrggbb'.
def _hs_colour_values(name, args, kwargs):
    if name != 'grid':
        return [_hs_tuple_colour(v) for v in args], {k: _hs_tuple_colour(v) for k, v in kwargs.items()}
    args = list(args)
    kwargs = dict(kwargs)
    flat = kwargs.get('width') is not None

    def cells(rows):
        if not isinstance(rows, (list, tuple)):
            return rows
        if flat:
            return [_hs_tuple_colour(v) for v in rows]
        return [[_hs_tuple_colour(v) for v in row] if isinstance(row, (list, tuple)) else row for row in rows]

    def palette(value):
        return [_hs_tuple_colour(v) for v in value] if isinstance(value, (list, tuple)) else value

    if args:
        args[0] = cells(args[0])
    elif 'rows' in kwargs:
        kwargs['rows'] = cells(kwargs['rows'])
    if len(args) > 1:
        args[1] = palette(args[1])
    elif 'palette' in kwargs:
        kwargs['palette'] = palette(kwargs['palette'])
    return args, kwargs


_hs_draw_plain = _draw


def _draw(name, args, kwargs, label=None):
    args, kwargs = _hs_colour_values(name, args, kwargs)
    _hs_draw_plain(name, args, kwargs, label)
`
