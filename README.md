# Math Graph Lab

고등학교 함수 그래프 탐구를 위한 모바일 최적화 웹도구입니다.

## 주요 기능

- `f(x)` 식 입력 후 즉시 그래프 렌더링
- 선택형 `g(x)` 보조 그래프와 두 그래프의 교점 표시
- `a`, `b`, `c` 계수 슬라이더와 직접 입력
- 꼭짓점, 축의 방정식, y절편, x절편, 정의역 상태 표시
- x축/y축 평행 보조선과 그래프 만나는 점 강조
- 비율 관계, 접선의 방정식, 정적분 근사 도구
- 리만 직사각형 표시 옵션
- 그래프 확대/축소, 이동, 자동 맞춤
- PNG 저장, WebM 화면 녹화, 공유 링크 복사
- 모바일 세로 화면에서 바로 쓰기 좋은 조작 패널

## 식 입력

식에는 `x`, `a`, `b`, `c`와 기본 함수(`sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `ln`, `exp`)를 사용할 수 있습니다.

예시:

```text
a*x^2 + b*x + c
a*(x-b)^2+c
a*sin(b*x)+c
```

## Render 배포

이 프로젝트는 정적 사이트입니다.

- Service type: Static Site
- Build command: `echo Static site ready`
- Publish directory: `.`

`render.yaml`이 포함되어 있어 Render Blueprint로도 배포할 수 있습니다.
