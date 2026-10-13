def score_match(source, candidate):
    """Считает степень совпадения двух квартир (0..100).

    source    — квартира текущего пользователя
    candidate — потенциально подходящая чужая квартира
    """
    score = 0

    # Город — самый важный параметр
    if source.city and candidate.city:
        if source.city.strip().lower() == candidate.city.strip().lower():
            score += 40
        else:
            # Разные города: обмен почти невозможен, но не отбрасываем сразу
            score += 5

    # Количество комнат
    rooms_diff = abs((source.rooms or 0) - (candidate.rooms or 0))
    score += max(0, 20 - rooms_diff * 7)

    # Площадь
    if source.area and candidate.area:
        area_diff = abs(source.area - candidate.area)
        score += max(0, 20 - int(area_diff))

    # Цена
    if source.price and candidate.price:
        rel_diff = abs(source.price - candidate.price) / max(source.price, candidate.price)
        score += max(0, 20 - int(rel_diff * 20))

    return min(score, 100)


def find_matches(source, candidates, min_score=40):
    """Возвращает список (квартира, score), отсортированный по убыванию."""
    results = []
    for candidate in candidates:
        if candidate.id == source.id:
            continue
        if candidate.owner_id == source.owner_id:
            continue
        current = score_match(source, candidate)
        if current >= min_score:
            results.append((candidate, current))

    results.sort(key=lambda item: item[1], reverse=True)
    return results
