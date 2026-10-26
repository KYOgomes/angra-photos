-- "Impressão digital visual" (dHash de 64 bits, em hex) para achar a mesma foto
-- mesmo depois de recomprimida pelo WhatsApp. Só fotos.
ALTER TABLE media ADD COLUMN phash TEXT;
