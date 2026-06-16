from app.services.rag_chunking import split_chunks


def test_split_chunks_ignores_tiny_content() -> None:
    assert split_chunks("too small") == []


def test_split_chunks_preserves_meaningful_content() -> None:
    chunks = split_chunks("This is a meaningful workspace memory chunk for indexing.")
    assert len(chunks) == 1
    assert "workspace memory" in chunks[0]
