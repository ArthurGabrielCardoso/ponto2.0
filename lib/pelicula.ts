/**
 * O fundo da película: o teal translúcido da tela de espera.
 *
 * Fica num lugar só porque três telas têm que ser LITERALMENTE iguais — a tela
 * de espera, a película que se abre quando a pessoa toca, e as telas cheias de
 * pergunta (tipo da batida, batida manual). Quando os valores eram copiados,
 * bastou um número diferente para o fundo deixar de parecer o mesmo produto.
 */
export const ESTILO_PELICULA = {
  background:
    "linear-gradient(135deg, rgba(29, 185, 179, 0.72) 0%, rgba(22, 145, 141, 0.75) 50%, rgba(13, 132, 136, 0.8) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
} as const
