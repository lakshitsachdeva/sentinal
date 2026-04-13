.PHONY: up down logs demo test

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

demo:
	python run_pipeline.py --mode demo

test:
	pytest -q
