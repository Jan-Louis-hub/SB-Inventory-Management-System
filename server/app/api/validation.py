MAX_INTEGER = 2_147_483_647


def integer_value(value, field, minimum=0):
    if isinstance(value, bool):
        raise ValueError(f"{field} must be an integer greater than or equal to {minimum}")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"{field} must be an integer greater than or equal to {minimum}"
        ) from error
    if (
        (isinstance(value, float) and not value.is_integer())
        or str(parsed) != str(value).strip()
        or parsed > MAX_INTEGER
    ):
        raise ValueError(f"{field} must be an integer in the supported range")
    if parsed < minimum:
        raise ValueError(f"{field} must be an integer greater than or equal to {minimum}")
    return parsed
